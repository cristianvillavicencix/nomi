import { useEffect, useState } from "react";
import { useGetIdentity, type Identifier } from "ra-core";

import { supabase } from "@/components/atomic-crm/providers/supabase/supabase";

type PresenceMeta = {
  member_id: string;
  joined_at: string;
};

/**
 * Online/offline tracking for the current organization via Supabase Realtime
 * Presence. Each tab opens (and tracks itself in) a channel keyed to its
 * org_id so every member of the same org sees the same online set.
 *
 * - No DB tables, no heartbeats: presence is held by the WebSocket itself.
 * - When the tab closes (or loses connectivity), Supabase fires `leave`
 *   server-side and the member drops out of the set automatically.
 * - Multiple tabs / devices for the same member collapse into a single
 *   member_id entry, so the green dot stays on until the last session ends.
 */
export const useOrgPresence = () => {
  const { identity } = useGetIdentity();
  const memberId = identity?.id;
  const orgId = (identity as { org_id?: number | string | null } | undefined)
    ?.org_id;

  const [onlineMemberIds, setOnlineMemberIds] = useState<Set<string>>(
    () => new Set(),
  );

  useEffect(() => {
    if (memberId == null || orgId == null) {
      return;
    }

    const channelName = `org-presence:${orgId}`;
    const channel = supabase.channel(channelName, {
      config: {
        presence: { key: String(memberId) },
      },
    });

    const syncFromChannel = () => {
      const state = channel.presenceState<PresenceMeta>();
      const next = new Set<string>();
      for (const key of Object.keys(state)) {
        next.add(key);
      }
      setOnlineMemberIds(next);
    };

    channel.on("presence", { event: "sync" }, syncFromChannel);
    channel.on("presence", { event: "join" }, syncFromChannel);
    channel.on("presence", { event: "leave" }, syncFromChannel);

    void channel.subscribe(async (status) => {
      if (status === "SUBSCRIBED") {
        await channel.track({
          member_id: String(memberId),
          joined_at: new Date().toISOString(),
        } satisfies PresenceMeta);
      }
    });

    return () => {
      void channel.untrack();
      void supabase.removeChannel(channel);
    };
  }, [memberId, orgId]);

  return {
    onlineMemberIds,
    isOnline: (id: Identifier | null | undefined) =>
      id != null && onlineMemberIds.has(String(id)),
  };
};
