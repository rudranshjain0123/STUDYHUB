import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useTrackPresence } from "@/hooks/use-presence";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async ({ location }) => {
    // getSession is read from local storage and refreshed in the background,
    // so the guard resolves instantly instead of waiting on a network call.
    const { data, error } = await supabase.auth.getSession();
    if (error || !data.session?.user) {
      // Keep the destination (e.g. a shared ?workId link) so login can return to it.
      throw redirect({ to: "/", search: { next: location.href } });
    }
    return { user: data.session.user };
  },
  component: AuthenticatedShell,
});

function AuthenticatedShell() {
  const [userId, setUserId] = useState<string>();
  useEffect(() => {
    void supabase.auth.getSession().then(({ data }) => {
      setUserId(data.session?.user.id);
    });
  }, []);
  useTrackPresence(userId);
  return <Outlet />;
}
