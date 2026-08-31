import { useQuery } from "@tanstack/react-query";
import { useGetList } from "ra-core";
import { supabase } from "@/components/atomic-crm/providers/supabase/supabase";
import type { Ticket } from "@/modules/types";

const MIN_QUERY_LENGTH = 2;

/** Ticket ids whose email/message body matches the search phrase. */
export const useTicketIdsMatchingMessageSearch = (query: string) => {
  const trimmed = query.trim();
  const enabled = trimmed.length >= MIN_QUERY_LENGTH;

  return useQuery({
    queryKey: ["ticket-message-search-ids", trimmed.toLowerCase()],
    enabled,
    staleTime: 30_000,
    queryFn: async (): Promise<number[]> => {
      const { data, error } = await supabase.rpc(
        "search_ticket_ids_by_message",
        {
          p_query: trimmed,
          p_limit: 100,
        },
      );
      if (error) throw error;
      const rows = Array.isArray(data) ? data : [];
      return rows
        .map((row) => Number(row))
        .filter((id) => Number.isFinite(id));
    },
  });
};

/** Load ticket rows for message-search hits (may be outside the current list page). */
export const useTicketsFromMessageSearch = (query: string) => {
  const idsQuery = useTicketIdsMatchingMessageSearch(query);
  const ids = idsQuery.data ?? [];
  const ticketsQuery = useGetList<Ticket>(
    "tickets",
    {
      pagination: { page: 1, perPage: Math.max(ids.length, 1) },
      sort: { field: "updated_at", order: "DESC" },
      filter:
        ids.length > 0
          ? {
              "id@in": `(${ids.join(",")})`,
              "merged_into_ticket_id@is": null,
            }
          : undefined,
    },
    { enabled: ids.length > 0 },
  );

  return {
    messageHitIds: new Set(ids.map(String)),
    messageHitTickets: ticketsQuery.data ?? [],
    isPending: Boolean(query.trim()) && (idsQuery.isPending || ticketsQuery.isPending),
    isError: idsQuery.isError || ticketsQuery.isError,
  };
};
