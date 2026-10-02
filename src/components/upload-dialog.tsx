import { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Loader2, UploadCloud } from "lucide-react";
import { toast } from "sonner";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import {
  ACCEPTED_EXTENSIONS,
  fileExtension,
  hasSubtypes,
  isBookOnly,
  SUBJECTS,
  SUBTYPES,
  UPLOAD_ACCEPT,
  WORK_TYPE_LABEL,
  type Subject,
  type Subtype,
  type WorkRecord,
  type WorkType,
} from "@/lib/study";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userId: string;
  editing: WorkRecord | null;
};

export function UploadDialog({ open, onOpenChange, userId, editing }: Props) {
  const queryClient = useQueryClient();
  const [title, setTitle] = useState("");
  const [subject, setSubject] = useState<Subject>("English");
  const [subtype, setSubtype] = useState<Subtype>("Literature");
  const [workType, setWorkType] = useState<WorkType>("notebook");
  const [file, setFile] = useState<File | null>(null);

  useEffect(() => {
    if (!open) return;
    setTitle(editing?.title ?? "");
    setSubject(editing?.subject ?? "English");
    setSubtype(editing?.subtype ?? "Literature");
    setWorkType(editing?.work_type ?? "notebook");
    setFile(null);
  }, [open, editing]);

  useEffect(() => {
    if (isBookOnly(subject)) setWorkType("book");
  }, [subject]);

  const mutation = useMutation({
    mutationFn: async () => {
      const cleanTitle = title.trim();
      if (!cleanTitle) throw new Error("Please add a title.");
      const finalSubtype = hasSubtypes(subject) ? subtype : null;
      const finalWorkType = isBookOnly(subject) ? "book" : workType;

      if (editing) {
        const { error } = await supabase
          .from("works")
          .update({
            title: cleanTitle,
            subject,
            subtype: finalSubtype,
            work_type: finalWorkType,
          })
          .eq("id", editing.id);
        if (error) throw error;
        return;
      }

      if (!file) throw new Error("Please choose a file.");
      const ext = fileExtension(file.name);
      if (!ACCEPTED_EXTENSIONS.includes(ext)) {
        throw new Error(`.${ext || "?"} files aren't supported yet.`);
      }
      if (file.size > 25 * 1024 * 1024) throw new Error("File must be smaller than 25 MB.");

      const path = `${userId}/${crypto.randomUUID()}.${ext}`;
      const { error: uploadError } = await supabase.storage
        .from("work-files")
        .upload(path, file, { contentType: file.type || "application/octet-stream" });
      if (uploadError) throw uploadError;

      const { error } = await supabase.from("works").insert({
        uploader_id: userId,
        title: cleanTitle,
        subject,
        subtype: finalSubtype,
        work_type: finalWorkType,
        storage_path: path,
        file_name: file.name,
      });
      if (error) {
        await supabase.storage.from("work-files").remove([path]);
        throw error;
      }
    },
    onSuccess: () => {
      toast.success(editing ? "Work updated." : "Work shared with the group!");
      void queryClient.invalidateQueries({ queryKey: ["works"] });
      onOpenChange(false);
    },
    onError: (error: Error) => toast.error(error.message || "Something went wrong."),
  });

  const bookOnly = isBookOnly(subject);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{editing ? "Edit work" : "Share new work"}</DialogTitle>
          <DialogDescription>
            {editing
              ? "Update the details of your upload. The file itself stays the same."
              : "Upload a PDF, image, document or notes file so your study group can read, download and discuss it."}
          </DialogDescription>
        </DialogHeader>

        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            mutation.mutate();
          }}
        >
          <div className="space-y-2">
            <Label htmlFor="title">Title</Label>
            <Input
              id="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Ch 4 — Photosynthesis notes"
              required
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Subject</Label>
              <Select value={subject} onValueChange={(v) => setSubject(v as Subject)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {SUBJECTS.map((s) => (
                    <SelectItem key={s} value={s}>
                      {s}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {hasSubtypes(subject) ? (
              <div className="space-y-2">
                <Label>Subtype</Label>
                <Select value={subtype} onValueChange={(v) => setSubtype(v as Subtype)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {SUBTYPES.map((s) => (
                      <SelectItem key={s} value={s}>
                        {s}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ) : null}
          </div>

          <div className="space-y-2">
            <Label>Work type</Label>
            <div className="flex gap-2">
              {(["book", "notebook"] as WorkType[]).map((type) => (
                <Button
                  key={type}
                  type="button"
                  variant={workType === type ? "default" : "outline"}
                  className="flex-1"
                  disabled={bookOnly && type === "notebook"}
                  onClick={() => setWorkType(type)}
                >
                  {WORK_TYPE_LABEL[type]}
                </Button>
              ))}
            </div>
            {bookOnly ? (
              <p className="text-xs text-muted-foreground">{subject} only supports Book Work.</p>
            ) : null}
          </div>

          {editing ? null : (
            <div className="space-y-2">
              <Label htmlFor="file">File</Label>
              <Input
                id="file"
                type="file"
                accept={UPLOAD_ACCEPT}
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                required
              />
              <p className="text-xs text-muted-foreground">
                PDF, images (JPG/PNG/WEBP), Word, PowerPoint, Excel and text notes — up to 25 MB.
                PDFs, images and text preview inline; others download to open.
              </p>
            </div>
          )}

          <DialogFooter>
            <Button type="submit" disabled={mutation.isPending}>
              {mutation.isPending ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <UploadCloud className="size-4" />
              )}
              {editing ? "Save changes" : "Upload"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
