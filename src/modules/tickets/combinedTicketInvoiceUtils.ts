import type { Company, Contact } from "@/components/atomic-crm/types";
import type { Ticket, TicketDeliverable } from "@/modules/types";
import { resolveTicketRequesterEmail } from "@/modules/tickets/ticketRequester";
import { allDeliverablesHaveBilling } from "@/modules/tickets/supplementPricing";

export const sortTicketsForCombinedInvoice = (tickets: Ticket[]) =>
  [...tickets].sort((a, b) => Number(a.id) - Number(b.id));

export const getCombinedTicketIds = (tickets: Ticket[]) =>
  sortTicketsForCombinedInvoice(tickets).map((ticket) => ticket.id);

export const validateTicketsForCombinedInvoice = (
  tickets: Ticket[],
  companyById: Map<string, Company>,
  contactById: Map<string, Contact>,
): string | null => {
  if (tickets.length < 2) {
    return "Select at least two tickets";
  }

  const sorted = sortTicketsForCombinedInvoice(tickets);
  const emails = sorted.map((ticket) => {
    const company = ticket.company_id
      ? companyById.get(String(ticket.company_id))
      : null;
    const contact = ticket.contact_id
      ? contactById.get(String(ticket.contact_id))
      : null;
    return resolveTicketRequesterEmail(ticket, company, contact)?.trim().toLowerCase();
  });

  if (emails.some((email) => !email)) {
    return "Every selected ticket needs a valid recipient email";
  }

  const primaryEmail = emails[0];
  if (emails.some((email) => email !== primaryEmail)) {
    return "Combined invoices require the same recipient email on every ticket";
  }

  for (const ticket of sorted) {
    if (!ticket.company_id && !ticket.contact_id) {
      return `Link a company or contact on ticket #${ticket.id}`;
    }
  }

  return null;
};

export const ticketHasReadyDeliverables = (deliverables: TicketDeliverable[]) => {
  const unbilled = deliverables.filter((file) => !file.invoiced_invoice_id);
  return unbilled.length > 0 && allDeliverablesHaveBilling(unbilled);
};

export const buildCombinedInvoicePropertySummary = (tickets: Ticket[]) =>
  sortTicketsForCombinedInvoice(tickets)
    .map((ticket) => ticket.subject?.trim() || `Ticket #${ticket.id}`)
    .join(" · ");
