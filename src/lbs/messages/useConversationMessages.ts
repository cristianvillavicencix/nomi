import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useGetList, type Identifier } from "ra-core";
import { supabase } from "@/components/atomic-crm/providers/supabase/supabase";
import type { ConversationMessage } from "@/lbs/types";
import {
  appendConversationMessageToCache,
  refreshConversationLists,
} from "@/lbs/messages/messagesRealtimeCache";

export const useConversationMessages = (
  conversationId: Identifier | null | undefined,
) => {
  const queryClient = useQueryClient();
  const {
    data: messages = [],
    isPending,
    refetch,
  } = useGetList<ConversationMessage>(
    "conversation_messages",
    {
      filter: conversationId ? { "conversation_id@eq": conversationId } : {},
      pagination: { page: 1, perPage: 300 },
      sort: { field: "created_at", order: "ASC" },
    },
    { enabled: conversationId != null, staleTime: 5_000 },
  );

  useEffect(() => {
    if (conversationId == null) return;

    const handleInsert = (payload: { new: Record<string, unknown> }) => {
      const row = payload.new;
      if (String(row.conversation_id) !== String(conversationId)) return;

      const message = row as ConversationMessage;
      appendConversationMessageToCache(queryClient, message);
      refreshConversationLists(queryClient);
    };

    const channel = supabase
      .channel(`conversation_messages:${conversationId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "conversation_messages",
          filter: `conversation_id=eq.${conversationId}`,
        },
        handleInsert,
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [conversationId, queryClient]);

  return { messages, isPending, refetch };
};
