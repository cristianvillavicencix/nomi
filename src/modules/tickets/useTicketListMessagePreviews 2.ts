import { useMemo } from "react";
import { useGetList } from "ra-core";
import type { TicketMessage } from "@/modules/types";
import { htmlToPlainText } from "@/modules/tickets/ticketReplyRichText";

const PREVIEW_MAX_LENGTH = 120;

const buildPreview = (message: TicketMessage) => {
  const source = message.body?.trim() || message.html_body || "";
  const text = htmlToPlainText(source).replace(/\s+/g, " ").trim();
  if (!text) {
    if (Array.isArray(message.attachments) && message.attachments.length > 0) {
      return "Attachment";
    }
    return null;
  }
  if (text.length <= PREVIEW_MAX_LENGTH) return text;
  return `${text.slice(0, PREVIEW_MAX_LENGTH).trimEnd()}…`;
};

export const useTicketListMessagePreviews = (
  ticketIds: Array<string | number>,
) => {
  const filter =
    ticketIds.length > 0
      ? { "ticket_id@in": `(${ticketIds.join(",")})` }
      : undefined;

  const { data: messages = [] } = useGetList<TicketMessage>("ticket_messages", {
    pagination: { page: 1, perPage: 500 },
    sort: { field: "created_at", order: "DESC" },
    filter,
    queryOptions: { enabled: ticketIds.length > 0, staleTime: 15_000 },
  });

  return useMemo(() => {
    const map = new Map<string, string>();
    for (const message of messages) {
      const ticketId = String(message.ticket_id);
      if (map.has(ticketId)) continue;
      const preview = buildPreview(message);
      if (preview) map.set(ticketId, preview);
    }
    return map;
  }, [messages]);
};
