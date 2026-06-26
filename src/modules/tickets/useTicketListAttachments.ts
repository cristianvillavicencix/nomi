import { useMemo } from "react";
import { useGetList } from "ra-core";
import type { TicketMessage } from "@/modules/types";

export const useTicketListAttachments = (ticketIds: Array<string | number>) => {
  const filter =
    ticketIds.length > 0
      ? { "ticket_id@in": `(${ticketIds.join(",")})` }
      : undefined;

  const { data: messages = [] } = useGetList<TicketMessage>("ticket_messages", {
    pagination: { page: 1, perPage: 500 },
    sort: { field: "created_at", order: "DESC" },
    filter,
    queryOptions: { enabled: ticketIds.length > 0 },
  });

  return useMemo(() => {
    const map = new Map<string, unknown[]>();

    for (const message of messages) {
      if (
        !Array.isArray(message.attachments) ||
        message.attachments.length === 0
      ) {
        continue;
      }
      const ticketId = String(message.ticket_id);
      const existing = map.get(ticketId) ?? [];
      map.set(ticketId, [...existing, ...message.attachments]);
    }

    return map;
  }, [messages]);
};
