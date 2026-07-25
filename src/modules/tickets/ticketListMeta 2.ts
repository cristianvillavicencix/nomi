import type { Company, Contact } from "@/components/atomic-crm/types";
import type { Ticket } from "@/modules/types";
import { resolveBillingRecipientEmail, resolveBillingRecipientPhone } from "@/modules/billing/billingRecipientResolution";
import {
  getContactFullName,
} from "@/modules/clients/clientShowUtils";
import { getPrimaryContactFullName } from "@/modules/clients/clientProfile";

const looksLikeUrl = (value?: string | null) => {
  const trimmed = value?.trim() ?? "";
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

/** Compare names loosely — treats "Gonzalez Roofing" and "Gonzalez Roofing LLC" as duplicates. */
export const ticketNamesOverlapAsSameEntity = (a: string, b: string) => {
  const normalize = (name: string) =>
    name
      .toLowerCase()
      .replace(/[^\w\s]/g, " ")
      .replace(/\b(llc|inc|corp|ltd|co|company|pllc|lp)\b/gi, "")
      .replace(/\s+/g, " ")
      .trim();

  const left = normalize(a);
  const right = normalize(b);
  if (!left || !right) return false;
  if (left === right) return true;
  return left.includes(right) || right.includes(left);
};

/** Person name for ticket headers — not the company name repeated from the email From line. */
export const resolveTicketPrimaryContactName = (
  ticket: Ticket,
  company?: Company | null,
  contact?: Contact | null,
): string | null => {
  if (contact) {
    const full = normalizeOptional(getContactFullName(contact));
    if (full) return full;
  }

  if (company) {
    const primary = normalizeOptional(getPrimaryContactFullName(company));
    if (primary) return primary;
  }

  const requester = normalizeOptional(ticket.requester_name);
  const companyName = normalizeOptional(company?.name);
  if (
    requester &&
    companyName &&
    ticketNamesOverlapAsSameEntity(requester, companyName)
  ) {
    return null;
  }

  return requester;
};

export const getTicketListMeta = (
  ticket: Ticket,
  company?: Company | null,
  contact?: Contact | null,
) => {
  const email = normalizeOptional(
    resolveBillingRecipientEmail({
      company,
      contact,
      ticketRequesterEmail: ticket.requester_email,
    }),
  );

  const phone = normalizeOptional(
    resolveBillingRecipientPhone({ company, contact }),
  );

  const subject = ticket.subject?.trim() ?? "";
  const website =
    normalizeOptional(company?.website) ??
    (looksLikeUrl(subject) ? normalizeOptional(subject) : null);

  return { email, phone, website };
};

export const formatTicketListMetaLine = (
  parts: Array<string | null | undefined>,
) => parts.map((part) => part?.trim()).filter(Boolean) as string[];

export const formatTicketWebsiteLabel = (website: string) => {
  const label = website.replace(/^https?:\/\//i, "").replace(/\/$/, "");
  return label ? `${label}/` : website;
};

export const ticketWebsiteHref = (website: string) =>
  /^https?:\/\//i.test(website)
    ? website
    : `https://${website.replace(/^\/\//, "")}`;
