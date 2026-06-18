import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/components/atomic-crm/providers/supabase/supabase";
import { invalidateQueriesForResource } from "@/lib/queryCache";

const refreshTicketsInbox = (queryClient: ReturnType<typeof useQueryClient>) => {
  void invalidateQueriesForResource(queryClient, "tickets");
  void invalidateQueriesForResource(queryClient, "ticket_messages");
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
        () => refreshTicketsInbox(queryClient),
      )
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "ticket_messages" },
        () => refreshTicketsInbox(queryClient),
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [enabled, queryClient]);
};
