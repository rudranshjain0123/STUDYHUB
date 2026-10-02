import { createFileRoute, redirect, useRouter } from "@tanstack/react-router";
import { z } from "zod";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { BookOpenCheck, KeyRound, Loader2, ShieldPlus } from "lucide-react";
import { toast } from "sonner";

import { bootstrapAdmin, getSetupStatus, loginWithPasscode } from "@/lib/auth.functions";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/")({
  validateSearch: z.object({ next: z.string().optional() }),
  head: () => ({
    meta: [
      { title: "StudyHub — Group Study & Assignment Sharing" },
      {
        name: "description",
        content:
          "Enter your passcode to open your study group's shared library of subject-wise book and notebook assignments.",
      },
      { property: "og:title", content: "StudyHub — Group Study & Assignment Sharing" },
      {
        property: "og:description",
        content:
          "Enter your passcode to open your study group's shared library of subject-wise book and notebook assignments.",
      },
    ],
  }),
  beforeLoad: async ({ search }) => {
    if (typeof window === "undefined") return;
    const { data } = await supabase.auth.getSession();
    if (data.session) {
      if (search.next) throw redirect({ href: search.next });
      throw redirect({ to: "/dashboard" });
    }
  },
  component: LoginPage,
});

function LoginPage() {
  const router = useRouter();
  const { next } = Route.useSearch();
  const setupStatus = useServerFn(getSetupStatus);
  const login = useServerFn(loginWithPasscode);
  const createAdmin = useServerFn(bootstrapAdmin);

  const { data: status, refetch } = useQuery({
    queryKey: ["setup-status"],
    queryFn: () => setupStatus({}),
  });

  const [passcode, setPasscode] = useState("");
  const [adminName, setAdminName] = useState("");
  const [adminPass, setAdminPass] = useState("");
  const [busy, setBusy] = useState(false);

  async function handleLogin(event: React.FormEvent) {
    event.preventDefault();
    if (!passcode.trim()) return;
    setBusy(true);
    try {
      const result = await login({ data: { passcode } });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      const { error } = await supabase.auth.setSession({
        access_token: result.access_token,
        refresh_token: result.refresh_token,
      });
      if (error) {
        toast.error("Could not start your session. Try again.");
        return;
      }
      toast.success("Welcome back!");
      // Return to the shared link the user originally opened, when there is one.
      if (next) await router.navigate({ href: next });
      else await router.navigate({ to: "/dashboard" });
    } finally {
      setBusy(false);
    }
  }

  async function handleSetup(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    try {
      const result = await createAdmin({
        data: { displayName: adminName, passcode: adminPass },
      });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success("Admin created — sign in with your passcode.");
      setPasscode(adminPass);
      setAdminName("");
      setAdminPass("");
      await refetch();
    } finally {
      setBusy(false);
    }
  }

  const needsSetup = status?.needsSetup === true;

  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden px-4 py-12">
      <div className="ruled-paper pointer-events-none absolute inset-0 opacity-70" aria-hidden />
      <div
        className="pointer-events-none absolute inset-y-0 left-8 w-px bg-paper-margin sm:left-20"
        aria-hidden
      />

      <div className="relative w-full max-w-md">
        <div className="mb-8 text-center">
          <span className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
            <BookOpenCheck className="size-3.5 text-highlight" />
            Group study library
          </span>
          <h1 className="mt-4 text-4xl font-semibold tracking-tight text-primary">StudyHub</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Shared assignments, notes and discussion for your class.
          </p>
        </div>

        <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
          {needsSetup ? (
            <form onSubmit={handleSetup} className="space-y-4">
              <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
                <ShieldPlus className="size-4 text-teal" />
                First-time setup — create the admin
              </div>
              <div className="space-y-2">
                <Label htmlFor="adminName">Admin display name</Label>
                <Input
                  id="adminName"
                  value={adminName}
                  onChange={(e) => setAdminName(e.target.value)}
                  placeholder="e.g. Ms. Sharma"
                  minLength={2}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="adminPass">Admin passcode (min 6 characters)</Label>
                <Input
                  id="adminPass"
                  value={adminPass}
                  onChange={(e) => setAdminPass(e.target.value)}
                  placeholder="Choose something hard to guess"
                  minLength={6}
                  required
                />
              </div>
              <Button type="submit" className="w-full" disabled={busy}>
                {busy ? <Loader2 className="size-4 animate-spin" /> : null}
                Create admin account
              </Button>
            </form>
          ) : (
            <form onSubmit={handleLogin} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="passcode" className="flex items-center gap-2">
                  <KeyRound className="size-4 text-highlight" />
                  Enter your passcode
                </Label>
                <Input
                  id="passcode"
                  type="password"
                  autoComplete="one-time-code"
                  value={passcode}
                  onChange={(e) => setPasscode(e.target.value)}
                  placeholder="Your personal passcode"
                  className="text-center text-lg tracking-[0.3em]"
                  required
                />
              </div>
              <Button type="submit" className="w-full" disabled={busy}>
                {busy ? <Loader2 className="size-4 animate-spin" /> : null}
                Enter StudyHub
              </Button>
              <p className="text-center text-xs text-muted-foreground">
                Your passcode identifies you — ask your admin if you don't have one yet.
              </p>
            </form>
          )}
        </div>
      </div>
    </main>
  );
}
