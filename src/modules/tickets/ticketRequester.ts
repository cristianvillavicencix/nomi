import type { Identifier } from "ra-core";
import type { Company, Contact } from "@/components/atomic-crm/types";
import type { Ticket, TicketMessage } from "@/modules/types";
import {
  getContactEmail,
  getContactFullName,
} from "@/modules/clients/clientShowUtils";
import { resolveCompanyEmailForDisplay } from "@/modules/clients/companyChannelResolvers";
import { DEFAULT_TICKET_INBOX_EMAIL } from "@/modules/tickets/ticketInboxConfig";
import {
  getTicketListMeta,
  resolveTicketPrimaryContactName,
} from "@/modules/tickets/ticketListMeta";

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const normalizeEmail = (value?: string | null) => {
  const trimmed = value?.trim().toLowerCase();
  if (!trimmed || !EMAIL_REGEX.test(trimmed)) return null;
  return trimmed;
};

export const buildTicketInboxEmailSet = (
  ticket: Pick<Ticket, "inbox_address">,
  inboxEmails: Array<string | null | undefined> = [],
) => {
  const emails = new Set<string>();
  for (const value of inboxEmails) {
    const normalized = normalizeEmail(value);
    if (normalized) emails.add(normalized);
  }
  const ticketInbox = normalizeEmail(ticket.inbox_address);
  if (ticketInbox) emails.add(ticketInbox);
  const fallbackInbox = normalizeEmail(DEFAULT_TICKET_INBOX_EMAIL);
  if (fallbackInbox) emails.add(fallbackInbox);
  return emails;
};

/** Gmail-style reply target, but never the ticket inbox (avoids reply loops). */
export const resolveTicketReplyRecipientEmail = ({
  ticket,
  company,
  contact,
  recentMessages,
  inboxEmails = [],
}: {
  ticket: Ticket;
  company?: Company | null;
  contact?: Contact | null;
  recentMessages: TicketMessage[];
  inboxEmails?: Array<string | null | undefined>;
}) => {
  const requester =
    normalizeEmail(resolveTicketRequesterEmail(ticket, company, contact)) ??
    normalizeEmail(ticket.requester_email);
  const inboxSet = buildTicketInboxEmailSet(ticket, inboxEmails);

  for (const message of recentMessages) {
    if (message.direction !== "inbound") continue;
    const from = normalizeEmail(message.from_email);
    if (!from || inboxSet.has(from)) continue;
    return from;
  }

  return requester ?? "";
};

export const isTicketInboxRecipient = (
  email: string,
  ticket: Pick<Ticket, "inbox_address">,
  inboxEmails: Array<string | null | undefined> = [],
) => {
  const normalized = normalizeEmail(email);
  if (!normalized) return false;
  return buildTicketInboxEmailSet(ticket, inboxEmails).has(normalized);
};

const normalize = (value?: string | null) => {
  const trimmed = value?.trim();
  if (!trimmed || trimmed === "—") return null;
  return trimmed;
};

export const resolveTicketRequesterEmail = (
  ticket: Ticket,
  company?: Company | null,
  contact?: Contact | null,
) => getTicketListMeta(ticket, company, contact).email;

export const resolveTicketRequesterName = (
  ticket: Ticket,
  contact?: Contact | null,
  company?: Company | null,
) => resolveTicketPrimaryContactName(ticket, company, contact);

export const getTicketClientFirstName = (
  ticket: Ticket,
  contact?: Contact | null,
  company?: Company | null,
) => {
  const name = resolveTicketRequesterName(ticket, contact, company);
  if (!name) return "there";
  const [firstName] = name.split(/\s+/);
  return firstName || name;
};

export const resolveRequesterFromContactAndCompany = (
  contact?: Contact | null,
  company?: Company | null,
) => {
  let email = contact ? normalize(getContactEmail(contact)) : null;
  let name = contact ? normalize(getContactFullName(contact)) : null;

  if (!email && company) {
    const companyEmail = resolveCompanyEmailForDisplay(company);
    if (companyEmail !== "—") email = companyEmail;
  }

  if (!name && company) {
    name = normalize(company.name);
  }

  return { email, name };
};

export const contactMatchesId = (
  contact: Contact,
  contactId: string | number | null | undefined,
) => contactId != null && String(contact.id) === String(contactId);

export const splitRequesterName = (name?: string | null) => {
  const trimmed = name?.trim();
  if (!trimmed) return { first_name: "", last_name: "" };
  const parts = trimmed.split(/\s+/);
  if (parts.length === 1) {
    return { first_name: parts[0] ?? "", last_name: "" };
  }
  return {
    first_name: parts[0] ?? "",
    last_name: parts.slice(1).join(" "),
  };
};

/** Prefill values for ContactFormDialog when saving an inbound ticket sender as a CRM contact. */
export const buildContactCreateDefaultsFromTicket = (
  ticket: Ticket,
  companyId?: Identifier | null,
) => {
  const { first_name, last_name } = splitRequesterName(ticket.requester_name);
  const email = ticket.requester_email?.trim() ?? "";
  const resolvedCompanyId = companyId ?? ticket.company_id ?? null;

  return {
    first_name,
    last_name,
    company_id: resolvedCompanyId,
    email_jsonb: [{ email, type: "Work" as const }],
    phone_jsonb: [{ number: "", type: "Work" as const }],
  };
};
