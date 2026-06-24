import type { Ticket } from "@/modules/types";

export const matchesTicketSearch = (
  ticket: Ticket,
  query: string,
  meta?: { email?: string | null; phone?: string | null; contactName?: string | null },
) => {
  const trimmed = query.trim().toLowerCase();
  if (!trimmed) return true;

  const haystack = [
    ticket.subject,
    ticket.requester_email,
    ticket.requester_name,
    meta?.email,
    meta?.phone,
    meta?.contactName,
    String(ticket.id),
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  return haystack.includes(trimmed);
};
