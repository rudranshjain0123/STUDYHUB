import { useQuery } from "@tanstack/react-query";
import type { User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

export type SessionProfile = {
  user: User;
  displayName: string;
  avatarColor: string;
  classSection: string | null;
  rollNumber: string | null;
  isAdmin: boolean;
};

export function useSessionProfile() {
  const { data, isPending } = useQuery({
    queryKey: ["session-profile"],
    staleTime: 10 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
    refetchOnWindowFocus: false,
    queryFn: async (): Promise<SessionProfile | null> => {
      // getSession reads the cached local session (no network round-trip).
      const { data: sessionData } = await supabase.auth.getSession();
      const user = sessionData.session?.user;
      if (!user) return null;

      const [{ data: prof }, { data: roles }] = await Promise.all([
        supabase
          .from("profiles")
          .select("display_name, avatar_color, class_section, roll_number")
          .eq("id", user.id)
          .maybeSingle(),
        supabase.from("user_roles").select("role").eq("user_id", user.id),
      ]);

      return {
        user,
        displayName: prof?.display_name ?? "Member",
        avatarColor: prof?.avatar_color ?? "teal",
        classSection: prof?.class_section ?? null,
        rollNumber: prof?.roll_number ?? null,
        isAdmin: (roles ?? []).some((r) => r.role === "admin"),
      };
    },
  });

  return { profile: data ?? null, loading: isPending };
}
