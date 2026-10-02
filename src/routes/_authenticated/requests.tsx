import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ClipboardCheck, ClipboardList, Loader2, UploadCloud } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";

import { AppHeader } from "@/components/app-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { useSessionProfile } from "@/hooks/use-session-profile";
import {
  ACCEPTED_EXTENSIONS,
  fileExtension,
  hasSubtypes,
  isBookOnly,
  SUBJECTS,
  SUBTYPES,
  timeAgo,
  UPLOAD_ACCEPT,
  WORK_TYPE_LABEL,
  type Subject,
  type Subtype,
  type WorkType,
} from "@/lib/study";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/requests")({
  head: () => ({
    meta: [
      { title: "Request Notes — StudyHub" },
      {
        name: "description",
        content: "Ask classmates for missing notes and fulfill open requests with uploads.",
      },
    ],
  }),
  component: RequestsPage,
});

type RequestStatus = "open" | "fulfilled";

type RequestRow = {
  id: string;
  requester_id: string;
  title: string;
  details: string;
  subject: Subject;
  subtype: Subtype | null;
  status: RequestStatus;
  fulfilled_by: string | null;
  fulfilled_work_id: string | null;
  created_at: string;
  fulfilled_at: string | null;
};

type RequestCard = RequestRow & {
  requesterName: string;
  fulfillerName: string | null;
  fulfilledWorkTitle: string | null;
};

function RequestsPage() {
  const queryClient = useQueryClient();
  const { profile, loading } = useSessionProfile();
  const [status, setStatus] = useState<RequestStatus | "all">("open");
  const [title, setTitle] = useState("");
  const [details, setDetails] = useState("");
  const [subject, setSubject] = useState<Subject>("Science");
  const [subtype, setSubtype] = useState<Subtype>("Literature");
  const [fulfilling, setFulfilling] = useState<RequestCard | null>(null);

  const { data: requests = [], isLoading } = useQuery({
    queryKey: ["note-requests"],
    queryFn: async (): Promise<RequestCard[]> => {
      const { data, error } = await supabase
        .from("note_requests")
        .select(
          "id, requester_id, title, details, subject, subtype, status, fulfilled_by, fulfilled_work_id, created_at, fulfilled_at",
        )
        .order("created_at", { ascending: false });
      if (error) throw error;
      const rows = (data ?? []) as RequestRow[];
      const userIds = [
        ...new Set(
          rows.flatMap((row) => [row.requester_id, row.fulfilled_by].filter(Boolean) as string[]),
        ),
      ];
      const workIds = [
        ...new Set(rows.map((row) => row.fulfilled_work_id).filter(Boolean) as string[]),
      ];
      const names = new Map<string, string>();
      const workTitles = new Map<string, string>();

      if (userIds.length) {
        const { data: profiles } = await supabase
          .from("profiles")
          .select("id, display_name")
          .in("id", userIds);
        for (const item of profiles ?? []) names.set(item.id, item.display_name);
      }
      if (workIds.length) {
        const { data: works } = await supabase.from("works").select("id, title").in("id", workIds);
        for (const item of works ?? []) workTitles.set(item.id, item.title);
      }

      return rows.map((row) => ({
        ...row,
        requesterName: names.get(row.requester_id) ?? "Member",
        fulfillerName: row.fulfilled_by ? (names.get(row.fulfilled_by) ?? "Member") : null,
        fulfilledWorkTitle: row.fulfilled_work_id
          ? (workTitles.get(row.fulfilled_work_id) ?? "Uploaded work")
          : null,
      }));
    },
  });

  const filtered = useMemo(() => {
    if (status === "all") return requests;
    return requests.filter((request) => request.status === status);
  }, [requests, status]);

  const createRequest = useMutation({
    mutationFn: async () => {
      if (!profile) throw new Error("Sign in again before posting a request.");
      const cleanTitle = title.trim();
      const cleanDetails = details.trim();
      if (cleanTitle.length < 3 || cleanDetails.length < 3) {
        throw new Error("Add a clear title and details.");
      }
      const { error } = await supabase.from("note_requests").insert({
        requester_id: profile.user.id,
        title: cleanTitle,
        details: cleanDetails,
        subject,
        subtype: hasSubtypes(subject) ? subtype : null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Request posted.");
      setTitle("");
      setDetails("");
      void queryClient.invalidateQueries({ queryKey: ["note-requests"] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  if (loading || !profile) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="relative min-h-screen">
      <div className="ruled-paper pointer-events-none fixed inset-0 opacity-60" aria-hidden />
      <div className="relative">
        <AppHeader
          userId={profile.user.id}
          displayName={profile.displayName}
          avatarColor={profile.avatarColor}
          classSection={profile.classSection}
          rollNumber={profile.rollNumber}
          isAdmin={profile.isAdmin}
          query=""
          onQueryChange={() => {}}
          searching={false}
          showSearch={false}
        />

        <main className="mx-auto max-w-6xl px-4 py-6">
          <div className="grid gap-5 lg:grid-cols-[360px_1fr]">
            <section className="rounded-xl border border-border bg-card p-5 shadow-sm">
              <div className="flex items-center gap-2 text-sm font-semibold text-teal">
                <ClipboardList className="size-4" />
                Help board
              </div>
              <h1 className="mt-1 font-display text-2xl font-semibold text-primary">
                Request notes
              </h1>
              <p className="mt-1 text-sm text-muted-foreground">
                Ask for missing pages, class diagrams, or revision sheets.
              </p>

              <form
                className="mt-5 space-y-4"
                onSubmit={(event) => {
                  event.preventDefault();
                  createRequest.mutate();
                }}
              >
                <div className="space-y-2">
                  <Label htmlFor="request-title">Request title</Label>
                  <Input
                    id="request-title"
                    value={title}
                    onChange={(event) => setTitle(event.target.value)}
                    placeholder="Need Ch 4 Science diagrams"
                    maxLength={120}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="request-details">Details</Label>
                  <Textarea
                    id="request-details"
                    value={details}
                    onChange={(event) => setDetails(event.target.value)}
                    placeholder="Mention period, page numbers, teacher notes, or anything classmates should know."
                    rows={4}
                    maxLength={1200}
                    required
                  />
                </div>
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1">
                  <div className="space-y-2">
                    <Label>Subject</Label>
                    <Select value={subject} onValueChange={(value) => setSubject(value as Subject)}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {SUBJECTS.map((item) => (
                          <SelectItem key={item} value={item}>
                            {item}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  {hasSubtypes(subject) ? (
                    <div className="space-y-2">
                      <Label>Subtype</Label>
                      <Select
                        value={subtype}
                        onValueChange={(value) => setSubtype(value as Subtype)}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {SUBTYPES.map((item) => (
                            <SelectItem key={item} value={item}>
                              {item}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  ) : null}
                </div>
                <Button type="submit" className="w-full" disabled={createRequest.isPending}>
                  {createRequest.isPending ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <ClipboardList className="size-4" />
                  )}
                  Post request
                </Button>
              </form>
            </section>

            <section>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="font-display text-xl font-semibold text-primary">Requests</h2>
                  <p className="text-sm text-muted-foreground">
                    {filtered.length} {filtered.length === 1 ? "request" : "requests"} shown
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  {(["open", "fulfilled", "all"] as const).map((item) => (
                    <button
                      key={item}
                      type="button"
                      onClick={() => setStatus(item)}
                      className={cn(
                        "rounded-full border px-4 py-1.5 text-sm font-medium capitalize transition-colors",
                        status === item
                          ? "border-primary bg-primary text-primary-foreground"
                          : "border-border bg-card text-foreground hover:border-primary/40",
                      )}
                    >
                      {item}
                    </button>
                  ))}
                </div>
              </div>

              {isLoading ? (
                <div className="flex justify-center py-16">
                  <Loader2 className="size-6 animate-spin text-muted-foreground" />
                </div>
              ) : filtered.length === 0 ? (
                <div className="mt-6 rounded-xl border border-dashed border-border bg-card/70 p-10 text-center">
                  <p className="font-display text-lg font-semibold">No requests here</p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Post one when you need help catching up.
                  </p>
                </div>
              ) : (
                <div className="mt-5 space-y-3">
                  {filtered.map((request) => (
                    <article
                      key={request.id}
                      className="rounded-xl border border-border bg-card p-5 shadow-sm"
                    >
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <h3 className="font-display text-lg font-semibold text-foreground">
                              {request.title}
                            </h3>
                            <Badge
                              className={
                                request.status === "open"
                                  ? "border-transparent bg-highlight/20 text-foreground"
                                  : "border-transparent bg-teal/15 text-teal"
                              }
                            >
                              {request.status === "open"
                                ? `Open · ${timeAgo(request.created_at)}`
                                : "Fulfilled"}
                            </Badge>
                          </div>
                          <p className="mt-1 text-sm text-muted-foreground">
                            Asked by {request.requesterName} · {request.subject}
                            {request.subtype ? ` · ${request.subtype}` : ""}
                          </p>
                        </div>
                        {request.status === "open" ? (
                          <Button size="sm" onClick={() => setFulfilling(request)}>
                            <UploadCloud className="size-4" />
                            Fulfill
                          </Button>
                        ) : null}
                      </div>
                      <p className="mt-3 whitespace-pre-wrap text-sm text-foreground">
                        {request.details}
                      </p>
                      {request.status === "fulfilled" ? (
                        <div className="mt-4 rounded-lg border border-teal/25 bg-teal/10 p-3 text-sm">
                          <p className="flex items-center gap-2 font-medium text-teal">
                            <ClipboardCheck className="size-4" />
                            Fulfilled by {request.fulfillerName ?? "a classmate"}
                          </p>
                          {request.fulfilled_work_id ? (
                            <Button asChild variant="link" className="mt-1 h-auto p-0 text-primary">
                              <Link to="/dashboard" search={{ workId: request.fulfilled_work_id }}>
                                {request.fulfilledWorkTitle ?? "Open uploaded notes"}
                              </Link>
                            </Button>
                          ) : null}
                        </div>
                      ) : null}
                    </article>
                  ))}
                </div>
              )}
            </section>
          </div>
        </main>
      </div>

      <FulfillDialog
        request={fulfilling}
        userId={profile.user.id}
        onOpenChange={(open) => {
          if (!open) setFulfilling(null);
        }}
      />
    </div>
  );
}

function FulfillDialog({
  request,
  userId,
  onOpenChange,
}: {
  request: RequestCard | null;
  userId: string;
  onOpenChange: (open: boolean) => void;
}) {
  const queryClient = useQueryClient();
  const [file, setFile] = useState<File | null>(null);
  const [workTitle, setWorkTitle] = useState("");

  const fulfill = useMutation({
    mutationFn: async () => {
      if (!request) throw new Error("Choose a request first.");
      if (!file) throw new Error("Drop or choose a file.");
      const ext = fileExtension(file.name);
      if (!ACCEPTED_EXTENSIONS.includes(ext)) {
        throw new Error(`.${ext || "?"} files are not supported yet.`);
      }
      if (file.size > 25 * 1024 * 1024) throw new Error("File must be smaller than 25 MB.");

      const path = `${userId}/${crypto.randomUUID()}.${ext}`;
      const { error: uploadError } = await supabase.storage
        .from("work-files")
        .upload(path, file, { contentType: file.type || "application/octet-stream" });
      if (uploadError) throw uploadError;

      const finalWorkType: WorkType = isBookOnly(request.subject) ? "book" : "notebook";
      const { data: work, error: insertError } = await supabase
        .from("works")
        .insert({
          uploader_id: userId,
          title: workTitle.trim() || request.title,
          subject: request.subject,
          subtype: request.subtype,
          work_type: finalWorkType,
          storage_path: path,
          file_name: file.name,
        })
        .select("id")
        .single();

      if (insertError || !work) {
        await supabase.storage.from("work-files").remove([path]);
        throw insertError ?? new Error("Could not create the linked upload.");
      }

      const { error: updateError } = await supabase
        .from("note_requests")
        .update({
          status: "fulfilled",
          fulfilled_by: userId,
          fulfilled_work_id: work.id,
          fulfilled_at: new Date().toISOString(),
        })
        .eq("id", request.id);
      if (updateError) throw updateError;
    },
    onSuccess: () => {
      toast.success("Request fulfilled and linked to the upload.");
      setFile(null);
      setWorkTitle("");
      void queryClient.invalidateQueries({ queryKey: ["note-requests"] });
      void queryClient.invalidateQueries({ queryKey: ["works"] });
      onOpenChange(false);
    },
    onError: (error: Error) => toast.error(error.message),
  });

  return (
    <Dialog open={Boolean(request)} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Fulfill request</DialogTitle>
          <DialogDescription>
            Upload the missing notes. StudyHub will publish them to Shared work and mark the request
            fulfilled.
          </DialogDescription>
        </DialogHeader>
        {request ? (
          <form
            className="space-y-4"
            onSubmit={(event) => {
              event.preventDefault();
              fulfill.mutate();
            }}
          >
            <div className="rounded-lg border border-border bg-muted/50 p-3">
              <p className="font-semibold">{request.title}</p>
              <p className="mt-1 text-sm text-muted-foreground">
                {request.subject}
                {request.subtype ? ` · ${request.subtype}` : ""} ·{" "}
                {WORK_TYPE_LABEL[isBookOnly(request.subject) ? "book" : "notebook"]}
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="fulfill-title">Upload title</Label>
              <Input
                id="fulfill-title"
                value={workTitle}
                onChange={(event) => setWorkTitle(event.target.value)}
                placeholder={request.title}
              />
            </div>
            <div
              className="rounded-xl border border-dashed border-border bg-card p-6 text-center transition-colors hover:border-primary/40"
              onDragOver={(event) => event.preventDefault()}
              onDrop={(event) => {
                event.preventDefault();
                setFile(event.dataTransfer.files?.[0] ?? null);
              }}
            >
              <UploadCloud className="mx-auto size-8 text-teal" />
              <p className="mt-2 text-sm font-medium">{file ? file.name : "Drop the file here"}</p>
              <p className="mt-1 text-xs text-muted-foreground">
                or choose a PDF, image, document, spreadsheet, or text file.
              </p>
              <Input
                className="mt-4"
                type="file"
                accept={UPLOAD_ACCEPT}
                onChange={(event) => setFile(event.target.files?.[0] ?? null)}
                required={!file}
              />
            </div>
            <DialogFooter>
              <Button type="submit" disabled={fulfill.isPending}>
                {fulfill.isPending ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <ClipboardCheck className="size-4" />
                )}
                Fulfill request
              </Button>
            </DialogFooter>
          </form>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
