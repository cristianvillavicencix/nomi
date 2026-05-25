import { useEffect } from "react";
import { useGetIdentity } from "ra-core";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/components/atomic-crm/providers/supabase/supabase";
import type { ConversationMessage } from "@/lbs/types";
import {
  appendConversationMessageToCache,
  refreshConversationLists,
} from "@/lbs/messages/messagesRealtimeCache";

export const useMessagesInboxRealtime = (enabled: boolean) => {
  const queryClient = useQueryClient();
  const { identity } = useGetIdentity();
  const memberId = identity?.id;

  useEffect(() => {
    if (!enabled) return;

    const channel = supabase
      .channel("messages_inbox_dock")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "conversation_messages",
        },
        (payload) => {
          const message = payload.new as ConversationMessage | undefined;
          if (!message?.conversation_id) return;
          appendConversationMessageToCache(queryClient, message);
          refreshConversationLists(queryClient);
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [enabled, queryClient]);

  useEffect(() => {
    if (!enabled || memberId == null) return;

    const channel = supabase
      .channel(`messages_inbox_participants:${memberId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "conversation_participants",
          filter: `member_id=eq.${memberId}`,
        },
        () => {
          refreshConversationLists(queryClient);
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [enabled, memberId, queryClient]);
};
