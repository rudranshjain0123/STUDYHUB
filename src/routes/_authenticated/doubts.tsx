import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, HelpCircle, ImagePlus, Loader2, Send, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";

import { AppHeader } from "@/components/app-header";
import { Badge } from "@/components/ui/badge";
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
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { useSessionProfile } from "@/hooks/use-session-profile";
import { fileExtension, IMAGE_EXTENSIONS, SUBJECTS, timeAgo, type Subject } from "@/lib/study";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/doubts")({
  head: () => ({
    meta: [
      { title: "Doubts & Q&A — StudyHub" },
      {
        name: "description",
        content: "Ask subject-wise doubts, attach diagrams and mark the best solution.",
      },
    ],
  }),
  component: DoubtsPage,
});

type QuestionRow = {
  id: string;
  author_id: string;
  subject: Subject;
  title: string;
  body: string;
  attachment_path: string | null;
  attachment_name: string | null;
  best_answer_id: string | null;
  created_at: string;
};

type AnswerRow = {
  id: string;
  question_id: string;
  author_id: string;
  body: string;
  created_at: string;
};

type QuestionCard = QuestionRow & {
  authorName: string;
  answers: Array<AnswerRow & { authorName: string }>;
};

function DoubtsPage() {
  const queryClient = useQueryClient();
  const { profile, loading } = useSessionProfile();
  const [subject, setSubject] = useState<Subject | "All">("All");
  const [newSubject, setNewSubject] = useState<Subject>("Maths");
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [attachment, setAttachment] = useState<File | null>(null);
  const [answerDrafts, setAnswerDrafts] = useState<Record<string, string>>({});

  const { data: questions = [], isLoading } = useQuery({
    queryKey: ["doubts"],
    queryFn: async (): Promise<QuestionCard[]> => {
      const { data: questionData, error } = await supabase
        .from("doubt_questions")
        .select(
          "id, author_id, subject, title, body, attachment_path, attachment_name, best_answer_id, created_at",
        )
        .order("created_at", { ascending: false });
      if (error) throw error;

      const rows = (questionData ?? []) as QuestionRow[];
      const questionIds = rows.map((question) => question.id);
      const { data: answerData } = questionIds.length
        ? await supabase
            .from("doubt_answers")
            .select("id, question_id, author_id, body, created_at")
            .in("question_id", questionIds)
            .order("created_at", { ascending: true })
        : { data: [] as AnswerRow[] };

      const answers = (answerData ?? []) as AnswerRow[];
      const userIds = [
        ...new Set([
          ...rows.map((row) => row.author_id),
          ...answers.map((answer) => answer.author_id),
        ]),
      ];
      const names = new Map<string, string>();
      if (userIds.length) {
        const { data: profiles } = await supabase
          .from("profiles")
          .select("id, display_name")
          .in("id", userIds);
        for (const item of profiles ?? []) names.set(item.id, item.display_name);
      }

      const answersByQuestion = new Map<string, Array<AnswerRow & { authorName: string }>>();
      for (const answer of answers) {
        const entry = { ...answer, authorName: names.get(answer.author_id) ?? "Member" };
        answersByQuestion.set(answer.question_id, [
          ...(answersByQuestion.get(answer.question_id) ?? []),
          entry,
        ]);
      }

      return rows.map((question) => ({
        ...question,
        authorName: names.get(question.author_id) ?? "Member",
        answers: answersByQuestion.get(question.id) ?? [],
      }));
    },
  });

  const filtered = useMemo(() => {
    if (subject === "All") return questions;
    return questions.filter((question) => question.subject === subject);
  }, [questions, subject]);

  const askQuestion = useMutation({
    mutationFn: async () => {
      if (!profile) throw new Error("Sign in again before asking a doubt.");
      let attachmentPath: string | null = null;
      let attachmentName: string | null = null;

      if (attachment) {
        const ext = fileExtension(attachment.name);
        if (!(IMAGE_EXTENSIONS as readonly string[]).includes(ext)) {
          throw new Error("Doubt attachments must be images.");
        }
        if (attachment.size > 10 * 1024 * 1024)
          throw new Error("Image must be smaller than 10 MB.");
        attachmentPath = `doubts/${profile.user.id}/${crypto.randomUUID()}.${ext}`;
        attachmentName = attachment.name;
        const { error: uploadError } = await supabase.storage
          .from("work-files")
          .upload(attachmentPath, attachment, { contentType: attachment.type || "image/*" });
        if (uploadError) throw uploadError;
      }

      const { error } = await supabase.from("doubt_questions").insert({
        author_id: profile.user.id,
        subject: newSubject,
        title: title.trim(),
        body: body.trim(),
        attachment_path: attachmentPath,
        attachment_name: attachmentName,
      });
      if (error) {
        if (attachmentPath) await supabase.storage.from("work-files").remove([attachmentPath]);
        throw error;
      }
    },
    onSuccess: () => {
      toast.success("Doubt posted.");
      setTitle("");
      setBody("");
      setAttachment(null);
      void queryClient.invalidateQueries({ queryKey: ["doubts"] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const answerQuestion = useMutation({
    mutationFn: async (questionId: string) => {
      if (!profile) throw new Error("Sign in again before answering.");
      const text = answerDrafts[questionId]?.trim();
      if (!text) throw new Error("Write an answer first.");
      const { error } = await supabase.from("doubt_answers").insert({
        question_id: questionId,
        author_id: profile.user.id,
        body: text,
      });
      if (error) throw error;
    },
    onSuccess: (_, questionId) => {
      setAnswerDrafts((prev) => ({ ...prev, [questionId]: "" }));
      void queryClient.invalidateQueries({ queryKey: ["doubts"] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const markBest = useMutation({
    mutationFn: async ({ questionId, answerId }: { questionId: string; answerId: string }) => {
      const { error } = await supabase
        .from("doubt_questions")
        .update({ best_answer_id: answerId })
        .eq("id", questionId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Best solution marked.");
      void queryClient.invalidateQueries({ queryKey: ["doubts"] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const deleteQuestion = useMutation({
    mutationFn: async (question: QuestionCard) => {
      const { error } = await supabase.from("doubt_questions").delete().eq("id", question.id);
      if (error) throw error;
      if (question.attachment_path) {
        await supabase.storage.from("work-files").remove([question.attachment_path]);
      }
    },
    onSuccess: () => {
      toast.success("Doubt deleted.");
      void queryClient.invalidateQueries({ queryKey: ["doubts"] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const deleteAnswer = useMutation({
    mutationFn: async (answerId: string) => {
      const { error } = await supabase.from("doubt_answers").delete().eq("id", answerId);
      if (error) throw error;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["doubts"] });
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
                <HelpCircle className="size-4" />
                Doubts desk
              </div>
              <h1 className="mt-1 font-display text-2xl font-semibold text-primary">Ask a doubt</h1>
              <p className="mt-1 text-sm text-muted-foreground">
                Add the subject, explain the problem, and attach a diagram when needed.
              </p>

              <form
                className="mt-5 space-y-4"
                onSubmit={(event) => {
                  event.preventDefault();
                  askQuestion.mutate();
                }}
              >
                <div className="space-y-2">
                  <Label>Subject</Label>
                  <Select
                    value={newSubject}
                    onValueChange={(value) => setNewSubject(value as Subject)}
                  >
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
                <div className="space-y-2">
                  <Label htmlFor="doubt-title">Question title</Label>
                  <Input
                    id="doubt-title"
                    value={title}
                    onChange={(event) => setTitle(event.target.value)}
                    placeholder="e.g. Why does this algebra step work?"
                    maxLength={140}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="doubt-body">Details</Label>
                  <Textarea
                    id="doubt-body"
                    value={body}
                    onChange={(event) => setBody(event.target.value)}
                    placeholder="Write the exact doubt, what you tried, and where you got stuck."
                    rows={5}
                    maxLength={3000}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="doubt-image" className="flex items-center gap-2">
                    <ImagePlus className="size-4 text-teal" />
                    Image / diagram
                  </Label>
                  <Input
                    id="doubt-image"
                    type="file"
                    accept={IMAGE_EXTENSIONS.map((ext) => `.${ext}`).join(",")}
                    onChange={(event) => setAttachment(event.target.files?.[0] ?? null)}
                  />
                  {attachment ? (
                    <p className="text-xs text-muted-foreground">{attachment.name}</p>
                  ) : null}
                </div>
                <Button type="submit" className="w-full" disabled={askQuestion.isPending}>
                  {askQuestion.isPending ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <HelpCircle className="size-4" />
                  )}
                  Post doubt
                </Button>
              </form>
            </section>

            <section>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="font-display text-xl font-semibold text-primary">Questions</h2>
                  <p className="text-sm text-muted-foreground">
                    {filtered.length} {filtered.length === 1 ? "question" : "questions"} shown
                  </p>
                </div>
                <nav aria-label="Doubt subjects" className="flex flex-wrap gap-2">
                  {(["All", ...SUBJECTS] as const).map((item) => (
                    <button
                      key={item}
                      type="button"
                      onClick={() => setSubject(item as Subject | "All")}
                      className={cn(
                        "rounded-full border px-3 py-1.5 text-sm font-medium transition-colors",
                        subject === item
                          ? "border-primary bg-primary text-primary-foreground"
                          : "border-border bg-card text-foreground hover:border-primary/40",
                      )}
                    >
                      {item}
                    </button>
                  ))}
                </nav>
              </div>

              {isLoading ? (
                <div className="flex justify-center py-16">
                  <Loader2 className="size-6 animate-spin text-muted-foreground" />
                </div>
              ) : filtered.length === 0 ? (
                <div className="mt-6 rounded-xl border border-dashed border-border bg-card/70 p-10 text-center">
                  <p className="font-display text-lg font-semibold">No doubts yet</p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Ask the first question for this subject.
                  </p>
                </div>
              ) : (
                <div className="mt-5 space-y-4">
                  {filtered.map((question) => (
                    <article
                      key={question.id}
                      className="rounded-xl border border-border bg-card p-5 shadow-sm"
                    >
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <Badge variant="secondary">{question.subject}</Badge>
                            {question.best_answer_id ? (
                              <Badge className="border-transparent bg-teal/15 text-teal">
                                Best solution
                              </Badge>
                            ) : null}
                          </div>
                          <h3 className="mt-2 font-display text-lg font-semibold text-foreground">
                            {question.title}
                          </h3>
                          <p className="text-sm text-muted-foreground">
                            Asked by {question.authorName} · {timeAgo(question.created_at)}
                          </p>
                        </div>
                        {question.author_id === profile.user.id || profile.isAdmin ? (
                          <Button
                            size="icon"
                            variant="ghost"
                            className="text-destructive hover:text-destructive"
                            aria-label="Delete doubt"
                            onClick={() => {
                              if (window.confirm("Delete this doubt and its answers?")) {
                                deleteQuestion.mutate(question);
                              }
                            }}
                          >
                            <Trash2 className="size-4" />
                          </Button>
                        ) : null}
                      </div>
                      <p className="mt-3 whitespace-pre-wrap text-sm text-foreground">
                        {question.body}
                      </p>
                      {question.attachment_path ? (
                        <QuestionAttachment
                          path={question.attachment_path}
                          name={question.attachment_name ?? "Attachment"}
                        />
                      ) : null}

                      <div className="mt-5 space-y-3">
                        <h4 className="text-sm font-semibold">
                          Answers ({question.answers.length})
                        </h4>
                        {question.answers.length === 0 ? (
                          <p className="text-sm text-muted-foreground">No answers yet.</p>
                        ) : (
                          question.answers.map((answer) => {
                            const best = question.best_answer_id === answer.id;
                            return (
                              <div
                                key={answer.id}
                                className={cn(
                                  "rounded-lg border p-3",
                                  best ? "border-teal/40 bg-teal/10" : "border-border bg-muted/30",
                                )}
                              >
                                <div className="flex flex-wrap items-center justify-between gap-2">
                                  <div className="flex flex-wrap items-center gap-2">
                                    <span className="text-sm font-semibold">
                                      {answer.authorName}
                                    </span>
                                    <span className="text-xs text-muted-foreground">
                                      {timeAgo(answer.created_at)}
                                    </span>
                                    {best ? (
                                      <Badge className="border-transparent bg-teal text-teal-foreground">
                                        <CheckCircle2 className="mr-1 size-3" />
                                        Best
                                      </Badge>
                                    ) : null}
                                  </div>
                                  <div className="flex items-center gap-1">
                                    {(question.author_id === profile.user.id || profile.isAdmin) &&
                                    !best ? (
                                      <Button
                                        size="sm"
                                        variant="ghost"
                                        onClick={() =>
                                          markBest.mutate({
                                            questionId: question.id,
                                            answerId: answer.id,
                                          })
                                        }
                                      >
                                        <CheckCircle2 className="size-4" />
                                        Best
                                      </Button>
                                    ) : null}
                                    {answer.author_id === profile.user.id || profile.isAdmin ? (
                                      <Button
                                        size="icon"
                                        variant="ghost"
                                        className="size-8 text-destructive hover:text-destructive"
                                        aria-label="Delete answer"
                                        onClick={() => deleteAnswer.mutate(answer.id)}
                                      >
                                        <Trash2 className="size-4" />
                                      </Button>
                                    ) : null}
                                  </div>
                                </div>
                                <p className="mt-2 whitespace-pre-wrap text-sm">{answer.body}</p>
                              </div>
                            );
                          })
                        )}

                        <form
                          className="flex flex-col gap-2 sm:flex-row"
                          onSubmit={(event) => {
                            event.preventDefault();
                            answerQuestion.mutate(question.id);
                          }}
                        >
                          <Input
                            value={answerDrafts[question.id] ?? ""}
                            onChange={(event) =>
                              setAnswerDrafts((prev) => ({
                                ...prev,
                                [question.id]: event.target.value,
                              }))
                            }
                            placeholder="Write an explanation..."
                          />
                          <Button type="submit" disabled={answerQuestion.isPending}>
                            <Send className="size-4" />
                            Answer
                          </Button>
                        </form>
                      </div>
                    </article>
                  ))}
                </div>
              )}
            </section>
          </div>
        </main>
      </div>
    </div>
  );
}

function QuestionAttachment({ path, name }: { path: string; name: string }) {
  const { data: url } = useQuery({
    queryKey: ["doubt-attachment", path],
    staleTime: 4 * 60 * 1000,
    queryFn: async () => {
      const { data, error } = await supabase.storage
        .from("work-files")
        .createSignedUrl(path, 5 * 60);
      if (error) throw error;
      return data.signedUrl;
    },
  });

  if (!url) {
    return (
      <div className="mt-3 rounded-lg border border-border bg-muted/40 p-3 text-sm text-muted-foreground">
        Loading attachment...
      </div>
    );
  }

  return (
    <a
      href={url}
      target="_blank"
      rel="noreferrer"
      className="mt-3 block overflow-hidden rounded-lg border border-border bg-muted/40"
    >
      <img src={url} alt={name} className="max-h-72 w-full object-contain" />
      <span className="block border-t border-border px-3 py-2 text-xs text-muted-foreground">
        {name}
      </span>
    </a>
  );
}
