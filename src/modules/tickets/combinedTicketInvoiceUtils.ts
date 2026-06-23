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
  const issues = getCombinedTicketInvoiceIssues(tickets, companyById, contactById);
  return issues[0]?.message ?? null;
};

export const ticketHasLinkedClient = (ticket: Ticket) =>
  Boolean(ticket.company_id || ticket.contact_id);

export type CombinedTicketInvoiceIssue = {
  ticketId: Ticket["id"];
  message: string;
  kind: "client" | "email" | "selection";
};

export const getCombinedTicketInvoiceIssues = (
  tickets: Ticket[],
  companyById: Map<string, Company>,
  contactById: Map<string, Contact>,
): CombinedTicketInvoiceIssue[] => {
  if (tickets.length < 2) {
    return [
      {
        ticketId: tickets[0]?.id ?? 0,
        kind: "selection",
        message: "Select at least two tickets",
      },
    ];
  }

  const sorted = sortTicketsForCombinedInvoice(tickets);
  const issues: CombinedTicketInvoiceIssue[] = [];

  for (const ticket of sorted) {
    if (!ticketHasLinkedClient(ticket)) {
      issues.push({
        ticketId: ticket.id,
        kind: "client",
        message: `Link a company or contact on ticket #${ticket.id}`,
      });
    }
  }

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
    issues.push({
      ticketId: sorted.find((ticket, index) => !emails[index])?.id ?? sorted[0]!.id,
      kind: "email",
      message: "Every selected ticket needs a valid recipient email",
    });
  } else {
    const primaryEmail = emails[0];
    const mismatch = sorted.find((ticket, index) => emails[index] !== primaryEmail);
    if (mismatch) {
      issues.push({
        ticketId: mismatch.id,
        kind: "email",
        message:
          "Combined invoices require the same recipient email on every ticket",
      });
    }
  }

  return issues;
};

export const ticketHasReadyDeliverables = (deliverables: TicketDeliverable[]) => {
  const unbilled = deliverables.filter((file) => !file.invoiced_invoice_id);
  return unbilled.length > 0 && allDeliverablesHaveBilling(unbilled);
};

export const buildCombinedInvoicePropertySummary = (tickets: Ticket[]) =>
  sortTicketsForCombinedInvoice(tickets)
    .map((ticket) => ticket.subject?.trim() || `Ticket #${ticket.id}`)
    .join(" · ");
