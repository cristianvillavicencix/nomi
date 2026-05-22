import { useEffect } from "react";
import { useGetList, type Identifier } from "ra-core";
import { supabase } from "@/components/atomic-crm/providers/supabase/supabase";
import type { ConversationMessage } from "@/lbs/types";

export const useConversationMessages = (
  conversationId: Identifier | null | undefined,
) => {
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
        () => {
          void refetch();
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [conversationId, refetch]);

  return { messages, isPending, refetch };
};
