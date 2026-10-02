import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Download, Loader2, Send, Star, Trash2 } from "lucide-react";
import { toast } from "sonner";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { FilePreview } from "@/components/file-preview";
import { supabase } from "@/integrations/supabase/client";
import { getWorkFileUrl } from "@/lib/works.functions";
import { fileKindLabel, formatDate, WORK_TYPE_LABEL, type WorkRecord } from "@/lib/study";

type Props = {
  work: WorkRecord | null;
  currentUserId: string;
  isAdmin?: boolean;
  bookmarked?: boolean;
  onBookmark?: () => void;
  onOpenChange: (open: boolean) => void;
};

type CommentRow = {
  id: string;
  work_id: string;
  author_id: string;
  body: string;
  created_at: string;
};

export function ViewerDialog({
  work,
  currentUserId,
  isAdmin = false,
  bookmarked = false,
  onBookmark,
  onOpenChange,
}: Props) {
  const queryClient = useQueryClient();
  const fileUrl = useServerFn(getWorkFileUrl);
  const [draft, setDraft] = useState("");

  useEffect(() => setDraft(""), [work?.id]);

  const { data: url, isLoading: urlLoading } = useQuery({
    queryKey: ["work-url", work?.id],
    enabled: Boolean(work),
    staleTime: 4 * 60 * 1000,
    queryFn: async () => {
      const result = await fileUrl({ data: { path: work!.storage_path } });
      return result.url;
    },
  });

  const { data: comments = [], isLoading: commentsLoading } = useQuery({
    queryKey: ["comments", work?.id],
    enabled: Boolean(work),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("comments")
        .select("id, work_id, author_id, body, created_at")
        .eq("work_id", work!.id)
        .order("created_at", { ascending: true });
      if (error) throw error;
      const rows = (data ?? []) as CommentRow[];
      const ids = [...new Set(rows.map((r) => r.author_id))];
      const names = new Map<string, string>();
      if (ids.length) {
        const { data: profiles } = await supabase
          .from("profiles")
          .select("id, display_name")
          .in("id", ids);
        for (const p of profiles ?? []) names.set(p.id, p.display_name);
      }
      return rows.map((r) => ({ ...r, author_name: names.get(r.author_id) ?? "Member" }));
    },
  });

  const addComment = useMutation({
    mutationFn: async () => {
      const body = draft.trim();
      if (!body) throw new Error("Write something first.");
      const { error } = await supabase
        .from("comments")
        .insert({ work_id: work!.id, author_id: currentUserId, body });
      if (error) throw error;
    },
    onSuccess: () => {
      setDraft("");
      void queryClient.invalidateQueries({ queryKey: ["comments", work?.id] });
      void queryClient.invalidateQueries({ queryKey: ["works"] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const removeComment = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("comments").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["comments", work?.id] });
      void queryClient.invalidateQueries({ queryKey: ["works"] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  return (
    <Dialog open={Boolean(work)} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] gap-0 overflow-hidden p-0 sm:max-w-5xl">
        {work ? (
          <>
            <DialogHeader className="border-b border-border px-5 py-4 text-left">
              <div className="flex items-start justify-between gap-3 pr-8">
                <DialogTitle className="text-lg">{work.title}</DialogTitle>
                {onBookmark ? (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={onBookmark}
                    aria-label={bookmarked ? "Remove from starred" : "Star for revision"}
                    title={bookmarked ? "Remove from starred" : "Star for revision"}
                  >
                    <Star
                      className={
                        bookmarked
                          ? "size-4 fill-highlight text-highlight"
                          : "size-4 text-muted-foreground"
                      }
                    />
                  </Button>
                ) : null}
              </div>
              <DialogDescription>
                {work.subject}
                {work.subtype ? ` · ${work.subtype}` : ""} · {WORK_TYPE_LABEL[work.work_type]} ·{" "}
                {fileKindLabel(work.file_name)} · uploaded by {work.uploader_name} on{" "}
                {formatDate(work.created_at)}
              </DialogDescription>
            </DialogHeader>

            <div className="grid max-h-[75vh] grid-cols-1 overflow-hidden md:grid-cols-[3fr_2fr]">
              <div className="min-h-[45vh] border-b border-border bg-muted md:border-r md:border-b-0">
                {urlLoading || !url ? (
                  <div className="flex h-full items-center justify-center">
                    <Loader2 className="size-6 animate-spin text-muted-foreground" />
                  </div>
                ) : (
                  <FilePreview url={url} fileName={work.file_name} label={work.title} />
                )}
              </div>

              <div className="flex max-h-[75vh] flex-col">
                <div className="flex items-center justify-between border-b border-border px-4 py-3">
                  <h4 className="text-sm font-semibold">Comments ({comments.length})</h4>
                  <Button size="sm" variant="outline" asChild disabled={!url}>
                    <a href={url ?? "#"} download={work.file_name}>
                      <Download className="size-4" />
                      Download
                    </a>
                  </Button>
                </div>

                <div className="flex-1 space-y-3 overflow-y-auto px-4 py-3">
                  {commentsLoading ? (
                    <Loader2 className="size-4 animate-spin text-muted-foreground" />
                  ) : comments.length === 0 ? (
                    <p className="text-sm text-muted-foreground">
                      No comments yet — start the discussion.
                    </p>
                  ) : (
                    comments.map((comment) => (
                      <div key={comment.id} className="rounded-lg border border-border bg-card p-3">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-sm font-semibold">{comment.author_name}</span>
                          <div className="flex items-center gap-1">
                            <span className="text-xs text-muted-foreground">
                              {formatDate(comment.created_at)}
                            </span>
                            {comment.author_id === currentUserId || isAdmin ? (
                              <Button
                                variant="ghost"
                                size="icon"
                                className="size-6 text-destructive"
                                aria-label="Delete comment"
                                onClick={() => {
                                  if (window.confirm("Delete this comment?")) {
                                    removeComment.mutate(comment.id);
                                  }
                                }}
                              >
                                <Trash2 className="size-3.5" />
                              </Button>
                            ) : null}
                          </div>
                        </div>
                        <p className="mt-1 text-sm whitespace-pre-wrap text-foreground">
                          {comment.body}
                        </p>
                      </div>
                    ))
                  )}
                </div>

                <form
                  className="space-y-2 border-t border-border p-3"
                  onSubmit={(e) => {
                    e.preventDefault();
                    addComment.mutate();
                  }}
                >
                  <Textarea
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    placeholder="Ask a doubt or add a note…"
                    rows={2}
                  />
                  <Button
                    type="submit"
                    size="sm"
                    className="w-full"
                    disabled={addComment.isPending}
                  >
                    {addComment.isPending ? (
                      <Loader2 className="size-4 animate-spin" />
                    ) : (
                      <Send className="size-4" />
                    )}
                    Post comment
                  </Button>
                </form>
              </div>
            </div>
          </>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
