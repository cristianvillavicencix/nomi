import { useCallback, useEffect, useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useGetList, type Identifier } from "ra-core";
import { supabase } from "@/components/atomic-crm/providers/supabase/supabase";
import type { ConversationMessage } from "@/lbs/types";
import {
  appendConversationMessageToCache,
  refreshConversationLists,
} from "@/lbs/messages/messagesRealtimeCache";

const PAGE_SIZE = 50;

export const useConversationMessages = (
  conversationId: Identifier | null | undefined,
) => {
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [olderMessages, setOlderMessages] = useState<ConversationMessage[]>([]);
  const [hasMoreOlder, setHasMoreOlder] = useState(false);
  const [loadingOlder, setLoadingOlder] = useState(false);

  useEffect(() => {
    setPage(1);
    setOlderMessages([]);
    setHasMoreOlder(false);
  }, [conversationId]);

  const {
    data: latestMessages = [],
    isPending,
    refetch,
    total = 0,
  } = useGetList<ConversationMessage>(
    "conversation_messages",
    {
      filter: conversationId ? { "conversation_id@eq": conversationId } : {},
      pagination: { page: 1, perPage: PAGE_SIZE },
      sort: { field: "created_at", order: "DESC" },
    },
    { enabled: conversationId != null, staleTime: 5_000 },
  );

  const messages = useMemo(() => {
    const merged = [...olderMessages, ...[...latestMessages].reverse()];
    const seen = new Set<string>();
    return merged.filter((message) => {
      const key = String(message.id);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }, [latestMessages, olderMessages]);

  useEffect(() => {
    if (conversationId == null) return;
    setHasMoreOlder(total > messages.length);
  }, [conversationId, messages.length, total]);

  const loadOlder = useCallback(async () => {
    if (conversationId == null || loadingOlder) return;
    setLoadingOlder(true);
    try {
      const nextPage = page + 1;
      const { data, error, count } = await supabase
        .from("conversation_messages")
        .select("*", { count: "exact" })
        .eq("conversation_id", conversationId)
        .is("deleted_at", null)
        .order("created_at", { ascending: false })
        .range((nextPage - 1) * PAGE_SIZE, nextPage * PAGE_SIZE - 1);

      if (error) throw error;

      const rows = (data ?? []) as ConversationMessage[];
      if (rows.length === 0) {
        setHasMoreOlder(false);
        return;
      }

      setOlderMessages((current) => [...[...rows].reverse(), ...current]);
      setPage(nextPage);
      setHasMoreOlder(count != null ? count > nextPage * PAGE_SIZE : rows.length === PAGE_SIZE);
    } finally {
      setLoadingOlder(false);
    }
  }, [conversationId, loadingOlder, page]);

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

  return { messages, isPending, refetch, loadOlder, hasMoreOlder, loadingOlder };
};
