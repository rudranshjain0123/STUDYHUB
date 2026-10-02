import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { BookOpen, Loader2, ShieldCheck, UsersRound } from "lucide-react";

import { AppHeader } from "@/components/app-header";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { usePresenceUserIds } from "@/hooks/use-presence";
import { useSessionProfile } from "@/hooks/use-session-profile";
import { avatarClass, initialsForName } from "@/lib/profile";
import { formatDate } from "@/lib/study";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/members")({
  head: () => ({
    meta: [
      { title: "Members — StudyHub" },
      {
        name: "description",
        content: "See classmates, roles, online status and study contributions.",
      },
    ],
  }),
  component: MembersPage,
});

type MemberProfile = {
  id: string;
  display_name: string;
  avatar_color: string;
  class_section: string | null;
  roll_number: string | null;
  created_at: string;
};

function MembersPage() {
  const { profile, loading } = useSessionProfile();
  const onlineIds = usePresenceUserIds();

  const { data: members = [], isLoading } = useQuery({
    queryKey: ["class-directory"],
    queryFn: async () => {
      const [{ data: profiles, error: profilesError }, { data: roles }, { data: works }] =
        await Promise.all([
          supabase
            .from("profiles")
            .select("id, display_name, avatar_color, class_section, roll_number, created_at")
            .order("display_name"),
          supabase.from("user_roles").select("user_id, role"),
          supabase.from("works").select("uploader_id"),
        ]);
      if (profilesError) throw profilesError;

      const adminIds = new Set(
        (roles ?? []).filter((role) => role.role === "admin").map((role) => role.user_id),
      );
      const counts = new Map<string, number>();
      for (const work of works ?? []) {
        counts.set(work.uploader_id, (counts.get(work.uploader_id) ?? 0) + 1);
      }

      return ((profiles ?? []) as MemberProfile[]).map((member) => ({
        id: member.id,
        displayName: member.display_name,
        avatarColor: member.avatar_color,
        classSection: member.class_section,
        rollNumber: member.roll_number,
        createdAt: member.created_at,
        isAdmin: adminIds.has(member.id),
        contributionCount: counts.get(member.id) ?? 0,
      }));
    },
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
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <div className="flex items-center gap-2 text-sm font-semibold text-teal">
                <UsersRound className="size-4" />
                Class directory
              </div>
              <h1 className="mt-1 font-display text-2xl font-semibold text-primary">Members</h1>
              <p className="text-sm text-muted-foreground">
                {members.length} classmates registered · {onlineIds.size} active now
              </p>
            </div>
          </div>

          {isLoading ? (
            <div className="flex justify-center py-16">
              <Loader2 className="size-6 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {members.map((member) => {
                const online = onlineIds.has(member.id);
                return (
                  <article
                    key={member.id}
                    className="rounded-xl border border-border bg-card p-5 shadow-sm"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex min-w-0 items-center gap-3">
                        <div className="relative">
                          <Avatar className="size-12">
                            <AvatarFallback
                              className={avatarClass(member.avatarColor, "text-base")}
                            >
                              {initialsForName(member.displayName)}
                            </AvatarFallback>
                          </Avatar>
                          <span
                            className={cn(
                              "absolute right-0 bottom-0 size-3 rounded-full border-2 border-card",
                              online ? "bg-emerald-500" : "bg-muted-foreground/35",
                            )}
                            title={online ? "Online" : "Away"}
                          />
                        </div>
                        <div className="min-w-0">
                          <h2 className="truncate font-semibold">{member.displayName}</h2>
                          <p className="truncate text-xs text-muted-foreground">
                            {[
                              member.classSection,
                              member.rollNumber ? `Roll ${member.rollNumber}` : null,
                            ]
                              .filter(Boolean)
                              .join(" · ") || "Class details not set"}
                          </p>
                        </div>
                      </div>
                      <Badge
                        className={
                          member.isAdmin
                            ? "border-transparent bg-teal/15 text-teal"
                            : "border-border bg-secondary text-secondary-foreground"
                        }
                      >
                        {member.isAdmin ? "Admin" : "Student"}
                      </Badge>
                    </div>

                    <div className="mt-5 grid grid-cols-2 gap-3 text-sm">
                      <div className="rounded-lg border border-border bg-muted/40 p-3">
                        <p className="text-xs text-muted-foreground">Joined</p>
                        <p className="mt-1 font-medium">{formatDate(member.createdAt)}</p>
                      </div>
                      <div className="rounded-lg border border-border bg-muted/40 p-3">
                        <p className="flex items-center gap-1 text-xs text-muted-foreground">
                          <BookOpen className="size-3.5" />
                          Notes
                        </p>
                        <p className="mt-1 font-medium">{member.contributionCount}</p>
                      </div>
                    </div>

                    <div className="mt-4 flex items-center justify-between text-xs text-muted-foreground">
                      <span className="inline-flex items-center gap-1.5">
                        <span
                          className={cn(
                            "size-2 rounded-full",
                            online ? "bg-emerald-500" : "bg-muted-foreground/35",
                          )}
                        />
                        {online ? "Studying now" : "Away"}
                      </span>
                      {member.isAdmin ? (
                        <span className="inline-flex items-center gap-1">
                          <ShieldCheck className="size-3.5" />
                          manages class
                        </span>
                      ) : null}
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
