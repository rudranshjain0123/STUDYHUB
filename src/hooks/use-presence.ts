import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

type PresencePayload = {
  user_id: string;
  online_at: string;
};

const PRESENCE_CHANNEL = "studyhub-presence";

function extractUserIds(state: Record<string, unknown[]>) {
  const ids = new Set<string>();
  for (const entries of Object.values(state)) {
    for (const entry of entries) {
      const payload = entry as Partial<PresencePayload>;
      if (payload.user_id) ids.add(payload.user_id);
    }
  }
  return ids;
}

export function useTrackPresence(userId: string | undefined) {
  useEffect(() => {
    if (!userId) return;

    const channel = supabase.channel(PRESENCE_CHANNEL, {
      config: { presence: { key: userId } },
    });

    channel.subscribe(async (status) => {
      if (status === "SUBSCRIBED") {
        await channel.track({ user_id: userId, online_at: new Date().toISOString() });
      }
    });

    return () => {
      void channel.untrack();
      void supabase.removeChannel(channel);
    };
  }, [userId]);
}

export function usePresenceUserIds() {
  const [onlineIds, setOnlineIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    const channel = supabase.channel(PRESENCE_CHANNEL);
    const sync = () => setOnlineIds(extractUserIds(channel.presenceState()));

    channel
      .on("presence", { event: "sync" }, sync)
      .on("presence", { event: "join" }, sync)
      .on("presence", { event: "leave" }, sync)
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, []);

  return onlineIds;
}
