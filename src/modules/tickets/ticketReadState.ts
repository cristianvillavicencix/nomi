import type { Ticket, TicketMessage } from "@/modules/types";

export type TicketMemberRead = {
  ticket_id: number;
  last_read_at: string;
};

export const isTicketUnread = (
  ticket: Pick<Ticket, "last_inbound_at">,
  lastReadAt?: string | null,
) => {
  const inboundAt = ticket.last_inbound_at;
  if (!inboundAt) return false;
  if (!lastReadAt) return true;
  return inboundAt > lastReadAt;
};

export const isInboundMessageUnread = (
  message: Pick<TicketMessage, "direction" | "created_at">,
  readCutoff?: string | null,
) => {
  if (readCutoff == null) return false;
  if (message.direction !== "inbound") return false;
  if (!message.created_at) return false;
  return message.created_at > readCutoff;
};

export const buildTicketReadMap = (rows: TicketMemberRead[]) => {
  const map = new Map<string, string>();
  for (const row of rows) {
    map.set(String(row.ticket_id), row.last_read_at);
  }
  return map;
};
