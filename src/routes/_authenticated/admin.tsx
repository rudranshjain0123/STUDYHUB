import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { ArrowLeft, Loader2, Trash2, UserPlus } from "lucide-react";
import { toast } from "sonner";

import { useSessionProfile } from "@/hooks/use-session-profile";
import { createMember, deleteMember, listMembers, updateMember } from "@/lib/admin.functions";
import { AppHeader } from "@/components/app-header";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { avatarClass, initialsForName } from "@/lib/profile";
import { formatDate } from "@/lib/study";

export const Route = createFileRoute("/_authenticated/admin")({
  head: () => ({
    meta: [
      { title: "Members & Passcodes — StudyHub Admin" },
      {
        name: "description",
        content: "Add study group members, reset their passcodes and manage admin access.",
      },
      { property: "og:title", content: "Members & Passcodes — StudyHub Admin" },
      {
        property: "og:description",
        content: "Add members, reset passcodes and manage admin access for your study group.",
      },
    ],
  }),
  component: AdminPage,
});

function AdminPage() {
  const queryClient = useQueryClient();
  const { profile, loading } = useSessionProfile();
  const fetchMembers = useServerFn(listMembers);
  const addMember = useServerFn(createMember);
  const editMember = useServerFn(updateMember);
  const removeMember = useServerFn(deleteMember);

  const [name, setName] = useState("");
  const [passcode, setPasscode] = useState("");
  const [classSection, setClassSection] = useState("");
  const [rollNumber, setRollNumber] = useState("");
  const [isAdmin, setIsAdmin] = useState(false);
  const [resetting, setResetting] = useState<Record<string, string>>({});

  const { data: members = [], isLoading } = useQuery({
    queryKey: ["members"],
    enabled: profile?.isAdmin === true,
    queryFn: () => fetchMembers({}),
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["members"] });

  const create = useMutation({
    mutationFn: () =>
      addMember({
        data: {
          displayName: name,
          passcode,
          classSection,
          rollNumber,
          isAdmin,
        },
      }),
    onSuccess: (result) => {
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success(`${name} can now sign in with that passcode.`);
      setName("");
      setPasscode("");
      setClassSection("");
      setRollNumber("");
      setIsAdmin(false);
      void invalidate();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const update = useMutation({
    mutationFn: (input: {
      userId: string;
      displayName?: string;
      passcode?: string;
      classSection?: string;
      rollNumber?: string;
      avatarColor?: string;
      isAdmin?: boolean;
    }) => editMember({ data: input }),
    onSuccess: (result, input) => {
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success("Member updated.");
      setResetting((prev) => ({ ...prev, [input.userId]: "" }));
      void invalidate();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const destroy = useMutation({
    mutationFn: (userId: string) => removeMember({ data: { userId } }),
    onSuccess: () => {
      toast.success("Member removed.");
      void invalidate();
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

  if (!profile.isAdmin) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 px-4 text-center">
        <h1 className="font-display text-2xl font-semibold">Admins only</h1>
        <p className="text-sm text-muted-foreground">
          Ask your group admin if you need access to member management.
        </p>
        <Button asChild variant="outline">
          <Link to="/dashboard">
            <ArrowLeft className="size-4" />
            Back to dashboard
          </Link>
        </Button>
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
          isAdmin
          query=""
          onQueryChange={() => {}}
          searching={false}
          showSearch={false}
        />

        <main className="mx-auto max-w-4xl px-4 py-6">
          <h1 className="font-display text-2xl font-semibold text-primary">
            Members &amp; passcodes
          </h1>
          <p className="text-sm text-muted-foreground">
            Each member signs in with a personal passcode. Passcodes are stored hashed and can only
            be replaced, never viewed.
          </p>

          <section className="mt-6 rounded-xl border border-border bg-card p-5 shadow-sm">
            <h2 className="flex items-center gap-2 font-semibold">
              <UserPlus className="size-4 text-teal" />
              Add a member
            </h2>
            <form
              className="mt-4 grid gap-4 sm:grid-cols-2"
              onSubmit={(e) => {
                e.preventDefault();
                create.mutate();
              }}
            >
              <div className="space-y-2">
                <Label htmlFor="member-name">Display name</Label>
                <Input
                  id="member-name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Ehaan"
                  minLength={2}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="member-pass">Passcode (min 6 characters)</Label>
                <Input
                  id="member-pass"
                  value={passcode}
                  onChange={(e) => setPasscode(e.target.value)}
                  minLength={6}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="member-section">Class / section</Label>
                <Input
                  id="member-section"
                  value={classSection}
                  onChange={(e) => setClassSection(e.target.value)}
                  placeholder="e.g. 9-B"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="member-roll">Roll number</Label>
                <Input
                  id="member-roll"
                  value={rollNumber}
                  onChange={(e) => setRollNumber(e.target.value)}
                  placeholder="Optional"
                />
              </div>
              <div className="flex items-end sm:col-span-2">
                <Button type="submit" disabled={create.isPending}>
                  {create.isPending ? <Loader2 className="size-4 animate-spin" /> : null}
                  Add
                </Button>
              </div>
              <label className="flex items-center gap-2 text-sm text-muted-foreground sm:col-span-2">
                <input
                  type="checkbox"
                  checked={isAdmin}
                  onChange={(e) => setIsAdmin(e.target.checked)}
                  className="size-4 accent-primary"
                />
                Make this member an admin
              </label>
            </form>
          </section>

          <section className="mt-6 space-y-3">
            {isLoading ? (
              <Loader2 className="size-5 animate-spin text-muted-foreground" />
            ) : (
              members.map((member) => (
                <div
                  key={member.id}
                  className="rounded-xl border border-border bg-card p-4 shadow-sm"
                >
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="flex min-w-0 items-center gap-3">
                      <Avatar className="size-10">
                        <AvatarFallback className={avatarClass(member.avatarColor)}>
                          {initialsForName(member.displayName)}
                        </AvatarFallback>
                      </Avatar>
                      <div className="min-w-0">
                        <p className="font-semibold">
                          {member.displayName}
                          {member.isAdmin ? (
                            <span className="ml-2 rounded-full bg-teal/15 px-2 py-0.5 text-xs text-teal">
                              admin
                            </span>
                          ) : null}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Joined {formatDate(member.createdAt)}
                          {" · "}
                          {member.contributionCount} uploads
                          {member.classSection ? ` · ${member.classSection}` : ""}
                          {member.rollNumber ? ` · Roll ${member.rollNumber}` : ""}
                        </p>
                      </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <Input
                        value={resetting[member.id] ?? ""}
                        onChange={(e) =>
                          setResetting((prev) => ({ ...prev, [member.id]: e.target.value }))
                        }
                        placeholder="New passcode"
                        className="h-9 w-40"
                      />
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={(resetting[member.id]?.length ?? 0) < 6 || update.isPending}
                        onClick={() =>
                          update.mutate({
                            userId: member.id,
                            passcode: resetting[member.id],
                          })
                        }
                      >
                        Reset
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        disabled={member.id === profile.user.id}
                        onClick={() =>
                          update.mutate({ userId: member.id, isAdmin: !member.isAdmin })
                        }
                      >
                        {member.isAdmin ? "Revoke admin" : "Make admin"}
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-destructive hover:text-destructive"
                        disabled={member.id === profile.user.id}
                        aria-label={`Remove ${member.displayName}`}
                        onClick={() => {
                          if (window.confirm(`Remove ${member.displayName}?`)) {
                            destroy.mutate(member.id);
                          }
                        }}
                      >
                        <Trash2 className="size-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </section>
        </main>
      </div>
    </div>
  );
}
