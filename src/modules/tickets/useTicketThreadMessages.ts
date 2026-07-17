import { useCallback, useEffect, useMemo, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useGetList, type Identifier } from "ra-core";
import { supabase } from "@/components/atomic-crm/providers/supabase/supabase";
import type { TicketMessage } from "@/modules/types";
import { appendTicketMessageToCache } from "@/modules/tickets/ticketsRealtimeCache";

export const useTicketThreadMessages = (
  ticketId: Identifier | null | undefined,
) => {
  const queryClient = useQueryClient();
  const threadTopRef = useRef<HTMLDivElement | null>(null);

  const {
    data: messages = [],
    isPending,
    refetch,
  } = useGetList<TicketMessage>(
    "ticket_messages",
    {
      filter: ticketId ? { "ticket_id@eq": ticketId } : {},
      pagination: { page: 1, perPage: 500 },
      sort: { field: "created_at", order: "DESC" },
    },
    { enabled: ticketId != null, staleTime: 5_000 },
  );

  const scrollToLatest = useCallback((behavior: ScrollBehavior = "smooth") => {
    threadTopRef.current?.scrollIntoView({ behavior, block: "start" });
  }, []);

  useEffect(() => {
    if (!ticketId || isPending) return;
    scrollToLatest("auto");
  }, [ticketId, isPending, messages.length, scrollToLatest]);

  useEffect(() => {
    if (ticketId == null) return;

    const handleChange = (payload: {
      eventType: string;
      new: Record<string, unknown>;
    }) => {
      const row = payload.new;
      if (String(row.ticket_id) !== String(ticketId)) return;
      appendTicketMessageToCache(queryClient, row as TicketMessage);
      if (payload.eventType === "INSERT") {
        requestAnimationFrame(() => scrollToLatest());
      }
    };

    const channel = supabase
      .channel(`ticket_messages:${ticketId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "ticket_messages",
          filter: `ticket_id=eq.${ticketId}`,
        },
        (payload) => handleChange({ eventType: "INSERT", new: payload.new }),
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "ticket_messages",
          filter: `ticket_id=eq.${ticketId}`,
        },
        (payload) => handleChange({ eventType: "UPDATE", new: payload.new }),
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [queryClient, scrollToLatest, ticketId]);

  const sortedMessages = useMemo(() => messages, [messages]);

  return {
    messages: sortedMessages,
    isPending: ticketId != null && isPending,
    refetch,
    /** @deprecated Use threadTopRef — kept for callers that still name it threadEndRef. */
    threadEndRef: threadTopRef,
    threadTopRef,
    scrollToBottom: scrollToLatest,
    scrollToLatest,
  };
};
