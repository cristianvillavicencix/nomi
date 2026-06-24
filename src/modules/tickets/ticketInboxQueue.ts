import type { Ticket } from "@/modules/types";
import { isTicketUnread } from "@/modules/tickets/ticketReadState";

export type TicketInboxQueueId = "all" | "unread" | "mine" | "waiting";

export const TICKET_INBOX_QUEUES: Array<{
  id: TicketInboxQueueId;
  label: string;
}> = [
  { id: "all", label: "All" },
  { id: "unread", label: "Unread" },
  { id: "mine", label: "Assigned to me" },
  { id: "waiting", label: "Waiting" },
];

export const countTicketsByQueue = (
  tickets: Ticket[],
  options: {
    memberId?: string | number | null;
    readMap: Map<string, string | null>;
  },
) => {
  const memberKey =
    options.memberId != null ? String(options.memberId) : null;
  const counts: Record<TicketInboxQueueId, number> = {
    all: 0,
    unread: 0,
    mine: 0,
    waiting: 0,
  };

  for (const ticket of tickets) {
    if (ticket.merged_into_ticket_id) continue;
    if (ticket.status === "resolved") continue;

    counts.all += 1;
    const ticketId = String(ticket.id);
    if (isTicketUnread(ticket, options.readMap.get(ticketId) ?? null)) {
      counts.unread += 1;
    }
    if (
      memberKey &&
      ticket.assignee_id != null &&
      String(ticket.assignee_id) === memberKey
    ) {
      counts.mine += 1;
    }
    if (ticket.status === "waiting") {
      counts.waiting += 1;
    }
  }

  return counts;
};

export const matchesTicketInboxQueue = (
  ticket: Ticket,
  queue: TicketInboxQueueId,
  options: {
    memberId?: string | number | null;
    lastReadAt?: string | null;
  },
) => {
  if (ticket.merged_into_ticket_id) return false;
  if (ticket.status === "resolved") return false;

  switch (queue) {
    case "all":
      return true;
    case "unread":
      return isTicketUnread(ticket, options.lastReadAt ?? null);
    case "mine": {
      const memberKey =
        options.memberId != null ? String(options.memberId) : null;
      if (!memberKey || ticket.assignee_id == null) return false;
      return String(ticket.assignee_id) === memberKey;
    }
    case "waiting":
      return ticket.status === "waiting";
    default:
      return true;
  }
};

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
