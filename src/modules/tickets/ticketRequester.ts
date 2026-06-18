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
