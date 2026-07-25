import type { Contact } from "@/components/atomic-crm/types";
import { getContactEmail } from "@/modules/clients/clientShowUtils";
import type { Ticket } from "@/modules/types";
import type { TicketStatusFilterId } from "@/modules/tickets/ticketInboxConfig";

export type ClientTicketScope = "company" | "contact";

export const collectContactRequesterEmails = (contacts: Contact[]) => {
  const emails = new Set<string>();
  for (const contact of contacts) {
    const email = getContactEmail(contact);
    if (email && email !== "—") {
      emails.add(email.trim().toLowerCase());
    }
  }
  return [...emails];
};

export const mergeScopedTickets = (
  primary: Ticket[],
  secondary: Ticket[],
  options: {
    scope: ClientTicketScope;
    companyId?: string | number | null;
    contactId?: string | number | null;
    requesterEmails: string[];
  },
) => {
  const map = new Map<string, Ticket>();
  const emailSet = new Set(options.requesterEmails);

  const includeTicket = (ticket: Ticket) => {
    if (ticket.merged_into_ticket_id) return false;

    if (options.scope === "company" && options.companyId != null) {
      const companyMatches =
        ticket.company_id != null &&
        String(ticket.company_id) === String(options.companyId);
      const email = ticket.requester_email?.trim().toLowerCase() ?? "";
      const emailMatches = email.length > 0 && emailSet.has(email);
      const unlinkedEmailMatch =
        emailMatches && (ticket.company_id == null || companyMatches);
      return companyMatches || unlinkedEmailMatch;
    }

    if (options.scope === "contact" && options.contactId != null) {
      const contactMatches =
        ticket.contact_id != null &&
        String(ticket.contact_id) === String(options.contactId);
      const email = ticket.requester_email?.trim().toLowerCase() ?? "";
      const emailMatches = email.length > 0 && emailSet.has(email);
      return contactMatches || emailMatches;
    }

    return true;
  };

  for (const ticket of [...primary, ...secondary]) {
    if (!includeTicket(ticket)) continue;
    map.set(String(ticket.id), ticket);
  }

  return [...map.values()].sort(
    (left, right) =>
      new Date(right.updated_at ?? 0).getTime() -
      new Date(left.updated_at ?? 0).getTime(),
  );
};

export const countClientHubTickets = (
  tickets: Array<{ status?: string | null; merged_into_ticket_id?: unknown }>,
) => {
  const counts: Record<TicketStatusFilterId, number> = {
    all: 0,
    new: 0,
    open: 0,
    waiting: 0,
    resolved: 0,
  };

  for (const ticket of tickets) {
    if (ticket.merged_into_ticket_id) continue;
    counts.all += 1;
    const status = ticket.status ?? "";
    if (status === "new") counts.new += 1;
    if (status === "open") counts.open += 1;
    if (status === "waiting") counts.waiting += 1;
    if (status === "resolved") counts.resolved += 1;
  }

  return counts;
};

export const filterClientHubTickets = (
  tickets: Ticket[],
  status: TicketStatusFilterId,
) => {
  if (status === "all") return tickets;
  return tickets.filter((ticket) => ticket.status === status);
};
