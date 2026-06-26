import type { Company, Contact } from "@/components/atomic-crm/types";
import type { Ticket, TicketDeliverable } from "@/modules/types";
import {
  resolveTicketRequesterEmail,
  resolveTicketRequesterName,
} from "@/modules/tickets/ticketRequester";
import { allDeliverablesHaveBilling } from "@/modules/tickets/supplementPricing";

export type CombinedTicketRecipient = {
  ticketId: Ticket["id"];
  name: string | null;
  email: string | null;
};

export const getCombinedTicketRecipients = (
  tickets: Ticket[],
  companyById: Map<string, Company>,
  contactById: Map<string, Contact>,
): CombinedTicketRecipient[] =>
  sortTicketsForCombinedInvoice(tickets).map((ticket) => {
    const company = ticket.company_id
      ? companyById.get(String(ticket.company_id))
      : null;
    const contact = ticket.contact_id
      ? contactById.get(String(ticket.contact_id))
      : null;

    return {
      ticketId: ticket.id,
      name: resolveTicketRequesterName(ticket, contact, company),
      email:
        resolveTicketRequesterEmail(ticket, company, contact)?.trim() ?? null,
    };
  });

export const sortTicketsForCombinedInvoice = (tickets: Ticket[]) =>
  [...tickets].sort((a, b) => Number(a.id) - Number(b.id));

export const getCombinedTicketIds = (tickets: Ticket[]) =>
  sortTicketsForCombinedInvoice(tickets).map((ticket) => ticket.id);

export const validateTicketsForCombinedInvoice = (
  tickets: Ticket[],
  companyById: Map<string, Company>,
  contactById: Map<string, Contact>,
): string | null => {
  const issues = getCombinedTicketInvoiceIssues(
    tickets,
    companyById,
    contactById,
  );
  return issues[0]?.message ?? null;
};

export const ticketHasLinkedClient = (ticket: Ticket) =>
  Boolean(ticket.company_id || ticket.contact_id);

export type CombinedTicketInvoiceIssue = {
  ticketId: Ticket["id"];
  message: string;
  kind: "client" | "email" | "selection";
  recipients?: CombinedTicketRecipient[];
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
  const recipients = getCombinedTicketRecipients(
    sorted,
    companyById,
    contactById,
  );

  for (const ticket of sorted) {
    if (!ticketHasLinkedClient(ticket)) {
      issues.push({
        ticketId: ticket.id,
        kind: "client",
        message: `Link a company or contact on ticket #${ticket.id}`,
      });
    }
  }

  const emails = recipients.map(
    (recipient) => recipient.email?.trim().toLowerCase() ?? null,
  );

  if (emails.some((email) => !email)) {
    const missingRecipient = recipients.find(
      (recipient) => !recipient.email?.trim(),
    );
    issues.push({
      ticketId: missingRecipient?.ticketId ?? sorted[0]!.id,
      kind: "email",
      message: "Every selected ticket needs a recipient email",
      recipients,
    });
  }

  return issues;
};

export type CombinedRecipientEmailOption = {
  email: string;
  ticketIds: Ticket["id"][];
  names: string[];
};

export const getCombinedRecipientEmailOptions = (
  tickets: Ticket[],
  companyById: Map<string, Company>,
  contactById: Map<string, Contact>,
): CombinedRecipientEmailOption[] => {
  const recipients = getCombinedTicketRecipients(
    tickets,
    companyById,
    contactById,
  );
  const byEmail = new Map<string, CombinedRecipientEmailOption>();

  for (const recipient of recipients) {
    const email = recipient.email?.trim();
    if (!email) continue;

    const key = email.toLowerCase();
    const entry = byEmail.get(key) ?? {
      email,
      ticketIds: [],
      names: [],
    };
    entry.ticketIds.push(recipient.ticketId);
    const name = recipient.name?.trim();
    if (name && !entry.names.includes(name)) {
      entry.names.push(name);
    }
    byEmail.set(key, entry);
  }

  return [...byEmail.values()].sort(
    (a, b) => Number(a.ticketIds[0]) - Number(b.ticketIds[0]),
  );
};

export const ticketHasReadyDeliverables = (
  deliverables: TicketDeliverable[],
) => {
  const unbilled = deliverables.filter((file) => !file.invoiced_invoice_id);
  return unbilled.length > 0 && allDeliverablesHaveBilling(unbilled);
};

export const buildCombinedInvoicePropertySummary = (tickets: Ticket[]) =>
  sortTicketsForCombinedInvoice(tickets)
    .map((ticket) => ticket.subject?.trim() || `Ticket #${ticket.id}`)
    .join(" · ");
