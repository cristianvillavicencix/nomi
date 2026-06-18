import type { Company, Contact } from "@/components/atomic-crm/types";
import type { Ticket } from "@/modules/types";
import {
  getContactEmail,
  getContactPhone,
} from "@/modules/clients/clientShowUtils";

const looksLikeUrl = (value: string) => {
  const trimmed = value.trim();
  if (!trimmed) return false;
  if (/^https?:\/\//i.test(trimmed)) return true;
  if (/^www\./i.test(trimmed)) return true;
  return /^[a-z0-9-]+(\.[a-z0-9-]+)+\/?/i.test(trimmed);
};

const normalizeOptional = (value?: string | null) => {
  const trimmed = value?.trim();
  if (!trimmed || trimmed === "—") return null;
  return trimmed;
};

export const getTicketListMeta = (
  ticket: Ticket,
  company?: Company | null,
  contact?: Contact | null,
) => {
  const contactEmail =
    contact != null ? normalizeOptional(getContactEmail(contact)) : null;
  const contactPhone =
    contact != null ? normalizeOptional(getContactPhone(contact)) : null;

  const companyEmail = normalizeOptional(
    company?.primary_contact_email_jsonb
      ?.find((entry) => entry.email?.trim())
      ?.email?.trim(),
  );
  const companyPhone = normalizeOptional(company?.phone_number);

  const email =
    normalizeOptional(ticket.requester_email) ?? contactEmail ?? companyEmail;

  const phone = contactPhone ?? companyPhone;

  const subject = ticket.subject?.trim() ?? "";
  const website =
    (looksLikeUrl(subject) ? subject : null) ??
    normalizeOptional(company?.website);

  return { email, phone, website };
};

export const formatTicketListMetaLine = (
  parts: Array<string | null | undefined>,
) => parts.map((part) => part?.trim()).filter(Boolean) as string[];
