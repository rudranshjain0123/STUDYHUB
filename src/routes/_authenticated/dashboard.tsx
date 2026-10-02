import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { Loader2, Plus, Star } from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";

import { supabase } from "@/integrations/supabase/client";
import { useSessionProfile } from "@/hooks/use-session-profile";
import { semanticSearchWorks } from "@/lib/search.functions";
import { AppHeader } from "@/components/app-header";
import { WorkCard } from "@/components/work-card";
import { UploadDialog } from "@/components/upload-dialog";
import { ViewerDialog } from "@/components/viewer-dialog";
import { Button } from "@/components/ui/button";
import {
  hasSubtypes,
  isBookOnly,
  SUBJECTS,
  SUBTYPES,
  WORK_TYPE_LABEL,
  type Subject,
  type Subtype,
  type WorkRecord,
  type WorkType,
} from "@/lib/study";
import { cn } from "@/lib/utils";

const searchSchema = z.object({ workId: z.string().uuid().optional() });

export const Route = createFileRoute("/_authenticated/dashboard")({
  validateSearch: searchSchema,
  head: () => ({
    meta: [
      { title: "Dashboard — StudyHub Assignment Library" },
      {
        name: "description",
        content:
          "Browse, search and discuss subject-wise book and notebook assignments shared by your study group.",
      },
      { property: "og:title", content: "Dashboard — StudyHub Assignment Library" },
      {
        property: "og:description",
        content: "Browse, search and discuss assignments shared by your study group.",
      },
    ],
  }),
  component: Dashboard,
});

type WorkRow = {
  id: string;
  uploader_id: string;
  title: string;
  subject: Subject;
  subtype: Subtype | null;
  work_type: WorkType;
  storage_path: string;
  file_name: string;
  created_at: string;
  comments: { count: number }[] | null;
};

function Dashboard() {
  const { workId } = Route.useSearch();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { profile, loading: profileLoading } = useSessionProfile();
  const runSearch = useServerFn(semanticSearchWorks);

  const [subject, setSubject] = useState<Subject | "All">("All");
  const [subtype, setSubtype] = useState<Subtype | "All">("All");
  const [workType, setWorkType] = useState<WorkType | "All">("All");
  const [showStarred, setShowStarred] = useState(false);
  const [query, setQuery] = useState("");
  const [debounced, setDebounced] = useState("");
  const [uploadOpen, setUploadOpen] = useState(false);
  const [editing, setEditing] = useState<WorkRecord | null>(null);
  const [viewing, setViewing] = useState<WorkRecord | null>(null);

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(query.trim()), 200);
    return () => clearTimeout(timer);
  }, [query]);

  const { data: works = [], isLoading } = useQuery({
    queryKey: ["works"],
    queryFn: async (): Promise<WorkRecord[]> => {
      const { data, error } = await supabase
        .from("works")
        .select(
          "id, uploader_id, title, subject, subtype, work_type, storage_path, file_name, created_at, comments(count)",
        )
        .order("created_at", { ascending: false });
      if (error) throw error;
      const rows = (data ?? []) as unknown as WorkRow[];
      const ids = [...new Set(rows.map((r) => r.uploader_id))];
      const names = new Map<string, string>();
      if (ids.length) {
        const { data: profiles } = await supabase
          .from("profiles")
          .select("id, display_name")
          .in("id", ids);
        for (const p of profiles ?? []) names.set(p.id, p.display_name);
      }
      return rows.map((row) => ({
        id: row.id,
        uploader_id: row.uploader_id,
        title: row.title,
        subject: row.subject,
        subtype: row.subtype,
        work_type: row.work_type,
        storage_path: row.storage_path,
        file_name: row.file_name,
        created_at: row.created_at,
        uploader_name: names.get(row.uploader_id) ?? "Member",
        comment_count: row.comments?.[0]?.count ?? 0,
      }));
    },
  });

  const { data: bookmarkedIds = new Set<string>() } = useQuery({
    queryKey: ["bookmarks", profile?.user.id],
    enabled: Boolean(profile),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("bookmarks")
        .select("work_id")
        .eq("user_id", profile!.user.id);
      if (error) throw error;
      return new Set((data ?? []).map((row) => row.work_id));
    },
  });

  const { data: semantic, isFetching: searching } = useQuery({
    queryKey: ["semantic-search", debounced, works.length],
    enabled: debounced.length >= 2 && works.length > 0,
    staleTime: 5 * 60 * 1000,
    queryFn: () =>
      runSearch({
        data: {
          query: debounced,
          items: works.slice(0, 150).map((w) => ({
            id: w.id,
            title: w.title,
            subject: w.subject,
            subtype: w.subtype,
            workType: WORK_TYPE_LABEL[w.work_type],
            uploader: w.uploader_name,
          })),
        },
      }),
  });

  const deleteWork = useMutation({
    mutationFn: async (work: WorkRecord) => {
      const { error } = await supabase.from("works").delete().eq("id", work.id);
      if (error) throw error;
      await supabase.storage.from("work-files").remove([work.storage_path]);
    },
    onSuccess: () => {
      toast.success("Work deleted.");
      void queryClient.invalidateQueries({ queryKey: ["works"] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const toggleBookmark = useMutation({
    mutationFn: async (workId: string) => {
      if (!profile) throw new Error("Sign in again to star work.");
      if (bookmarkedIds.has(workId)) {
        const { error } = await supabase
          .from("bookmarks")
          .delete()
          .eq("user_id", profile.user.id)
          .eq("work_id", workId);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("bookmarks")
          .insert({ user_id: profile.user.id, work_id: workId });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["bookmarks", profile?.user.id] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const filtered = useMemo(() => {
    let list = works;
    if (showStarred) list = list.filter((w) => bookmarkedIds.has(w.id));
    if (subject !== "All") list = list.filter((w) => w.subject === subject);
    if (subject !== "All" && hasSubtypes(subject) && subtype !== "All") {
      list = list.filter((w) => w.subtype === subtype);
    }
    if (workType !== "All") list = list.filter((w) => w.work_type === workType);
    if (debounced.length > 0) list = applySearch(list, debounced, semantic?.ids);
    return list;
  }, [works, showStarred, bookmarkedIds, subject, subtype, workType, debounced, semantic]);

  // Auto-open a shared work link once the feed is available.
  useEffect(() => {
    if (!workId || !works.length) return;
    const target = works.find((w) => w.id === workId);
    if (target) setViewing(target);
  }, [workId, works]);

  if (profileLoading || !profile) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  function closeViewer() {
    setViewing(null);
    if (workId) void navigate({ to: "/dashboard", search: {}, replace: true });
  }

  async function share(work: WorkRecord) {
    const url = `${window.location.origin}/dashboard?workId=${work.id}`;
    if (navigator.share) {
      try {
        await navigator.share({ title: work.title, url });
        return;
      } catch {
        // user cancelled or share unavailable — fall through to copying
      }
    }
    try {
      await navigator.clipboard.writeText(url);
      toast.success("Share link copied to clipboard.");
    } catch {
      toast.info(url);
    }
  }

  async function download(work: WorkRecord) {
    const { data, error } = await supabase.storage
      .from("work-files")
      .createSignedUrl(work.storage_path, 60, { download: work.file_name });
    if (error || !data) {
      toast.error("Could not prepare the download.");
      return;
    }
    window.open(data.signedUrl, "_blank", "noopener");
  }

  const showSubtypes = subject !== "All" && hasSubtypes(subject);
  const bookOnly = subject !== "All" && isBookOnly(subject);

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
          query={query}
          onQueryChange={setQuery}
          searching={searching}
        />

        <main className="mx-auto max-w-6xl px-4 py-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h1 className="font-display text-2xl font-semibold text-primary">Shared work</h1>
              <p className="text-sm text-muted-foreground">
                {filtered.length} {filtered.length === 1 ? "item" : "items"}
                {debounced.length > 0 ? " matching your search" : ""}
              </p>
            </div>
            <Button
              onClick={() => {
                setEditing(null);
                setUploadOpen(true);
              }}
            >
              <Plus className="size-4" />
              Upload work
            </Button>
          </div>

          <nav aria-label="Subjects" className="mt-5 flex flex-wrap gap-2">
            {(["All", ...SUBJECTS] as const).map((item) => (
              <button
                key={item}
                type="button"
                onClick={() => {
                  setShowStarred(false);
                  setSubject(item as Subject | "All");
                  setSubtype("All");
                  if (item !== "All" && isBookOnly(item as Subject)) setWorkType("book");
                }}
                className={cn(
                  "rounded-full border px-4 py-1.5 text-sm font-medium transition-colors",
                  subject === item
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border bg-card text-foreground hover:border-primary/40",
                )}
              >
                {item}
              </button>
            ))}
            <button
              type="button"
              onClick={() => setShowStarred((value) => !value)}
              className={cn(
                "inline-flex items-center gap-2 rounded-full border px-4 py-1.5 text-sm font-medium transition-colors",
                showStarred
                  ? "border-highlight bg-highlight text-highlight-foreground"
                  : "border-border bg-card text-foreground hover:border-highlight/50",
              )}
            >
              <Star className={showStarred ? "size-4 fill-current" : "size-4"} />
              Starred
            </button>
          </nav>

          <div className="mt-3 flex flex-wrap items-center gap-4">
            {showSubtypes ? (
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                  Subtype
                </span>
                {(["All", ...SUBTYPES] as const).map((item) => (
                  <button
                    key={item}
                    type="button"
                    onClick={() => setSubtype(item as Subtype | "All")}
                    className={cn(
                      "rounded-md border px-3 py-1 text-sm transition-colors",
                      subtype === item
                        ? "border-teal bg-teal/15 text-teal"
                        : "border-border bg-card hover:border-teal/40",
                    )}
                  >
                    {item}
                  </button>
                ))}
              </div>
            ) : null}

            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                Work type
              </span>
              {(["All", "book", "notebook"] as const).map((item) => (
                <button
                  key={item}
                  type="button"
                  disabled={bookOnly && item === "notebook"}
                  onClick={() => setWorkType(item as WorkType | "All")}
                  className={cn(
                    "rounded-md border px-3 py-1 text-sm transition-colors disabled:cursor-not-allowed disabled:opacity-40",
                    workType === item
                      ? "border-highlight bg-highlight/20 text-foreground"
                      : "border-border bg-card hover:border-highlight/50",
                  )}
                >
                  {item === "All" ? "All" : WORK_TYPE_LABEL[item]}
                </button>
              ))}
            </div>
          </div>

          {isLoading ? (
            <div className="flex justify-center py-16">
              <Loader2 className="size-6 animate-spin text-muted-foreground" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="mt-10 rounded-xl border border-dashed border-border bg-card/70 p-10 text-center">
              <p className="font-display text-lg font-semibold">Nothing here yet</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Upload the first PDF for this filter and get the group started.
              </p>
            </div>
          ) : (
            <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {filtered.map((work) => (
                <WorkCard
                  key={work.id}
                  work={work}
                  canManage={work.uploader_id === profile.user.id || profile.isAdmin}
                  bookmarked={bookmarkedIds.has(work.id)}
                  onBookmark={() => toggleBookmark.mutate(work.id)}
                  onView={() => setViewing(work)}
                  onDownload={() => void download(work)}
                  onShare={() => void share(work)}
                  onEdit={() => {
                    setEditing(work);
                    setUploadOpen(true);
                  }}
                  onDelete={() => {
                    if (window.confirm(`Delete “${work.title}”? This can't be undone.`)) {
                      deleteWork.mutate(work);
                    }
                  }}
                />
              ))}
            </div>
          )}
        </main>
      </div>

      <UploadDialog
        open={uploadOpen}
        onOpenChange={setUploadOpen}
        userId={profile.user.id}
        editing={editing}
      />
      <ViewerDialog
        work={viewing}
        currentUserId={profile.user.id}
        isAdmin={profile.isAdmin}
        bookmarked={viewing ? bookmarkedIds.has(viewing.id) : false}
        onBookmark={viewing ? () => toggleBookmark.mutate(viewing.id) : undefined}
        onOpenChange={(open) => {
          if (!open) closeViewer();
        }}
      />
    </div>
  );
}

/** Local keyword matching plus AI relevance: semantic hits are always included. */
function applySearch(list: WorkRecord[], raw: string, aiIds: string[] | undefined) {
  const text = raw.toLowerCase().trim();
  if (!text) return list;
  const tokens = [...new Set(text.split(/\s+/).filter(Boolean))];
  const aiRank = new Map((aiIds ?? []).map((id, index) => [id, index]));

  const scored = list.map((work) => {
    const haystack =
      `${work.title} ${work.uploader_name} ${work.subject} ${work.subtype ?? ""} ${WORK_TYPE_LABEL[work.work_type]} ${work.file_name}`.toLowerCase();
    let score = 0;

    if (haystack.includes(text)) score += 8;
    for (const token of tokens) if (haystack.includes(token)) score += 3;

    // AI relevance dominates: related results surface even with no literal match.
    const rank = aiRank.get(work.id);
    if (rank !== undefined) score += 40 - Math.min(rank, 29);

    return { work, score };
  });

  return scored
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score)
    .map((entry) => entry.work);
}
