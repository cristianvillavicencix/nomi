import type { Identifier } from "ra-core";
import type { Company, Contact } from "@/components/atomic-crm/types";
import type { Ticket } from "@/modules/types";
import {
  getContactEmail,
  getContactFullName,
} from "@/modules/clients/clientShowUtils";
import { resolveCompanyEmailForDisplay } from "@/modules/clients/companyChannelResolvers";
import { getTicketListMeta } from "@/modules/tickets/ticketListMeta";

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
) =>
  normalize(ticket.requester_name) ??
  (contact ? normalize(getContactFullName(contact)) : null) ??
  normalize(company?.name) ??
  null;

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
