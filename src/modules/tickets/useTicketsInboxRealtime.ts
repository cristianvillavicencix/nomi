import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/components/atomic-crm/providers/supabase/supabase";
import type { TicketMessage } from "@/modules/types";
import {
  appendTicketMessageToCache,
  refreshTicketInboxLists,
} from "@/modules/tickets/ticketsRealtimeCache";
import { invalidateQueriesForResource } from "@/lib/queryCache";

const refreshTicketBilling = (queryClient: ReturnType<typeof useQueryClient>) => {
  void invalidateQueriesForResource(queryClient, "client_invoices");
  void invalidateQueriesForResource(queryClient, "ticket_deliverables");
};

export const useTicketsInboxRealtime = (enabled: boolean) => {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!enabled) return;

    const channel = supabase
      .channel("tickets_inbox")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "tickets" },
        () => refreshTicketInboxLists(queryClient),
      )
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "ticket_messages" },
        (payload) => {
          appendTicketMessageToCache(
            queryClient,
            payload.new as TicketMessage,
          );
          refreshTicketInboxLists(queryClient);
        },
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "ticket_messages" },
        (payload) => {
          appendTicketMessageToCache(
            queryClient,
            payload.new as TicketMessage,
          );
        },
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "client_invoices" },
        () => refreshTicketBilling(queryClient),
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "ticket_deliverables" },
        () => refreshTicketBilling(queryClient),
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [enabled, queryClient]);
};
