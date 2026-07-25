import type { Company, Contact } from "@/components/atomic-crm/types";
import { parseLbsClientContextLinks } from "@/modules/clients/clientContextLinks";

const pickPrimaryEmailRow = (
  rows?: Array<{ email?: string | null; isPrimary?: boolean }> | null,
) => {
  const list = rows ?? [];
  const flagged = list.find(
    (row) => row.isPrimary && row.email?.trim(),
  )?.email?.trim();
  if (flagged) return flagged;
  return list.find((row) => row.email?.trim())?.email?.trim() ?? "";
};

const pickPrimaryPhoneRow = (
  rows?: Array<{ number?: string | null; isPrimary?: boolean }> | null,
) => {
  const list = rows ?? [];
  const flagged = list.find(
    (row) => row.isPrimary && row.number?.trim(),
  )?.number?.trim();
  if (flagged) return flagged;
  return list.find((row) => row.number?.trim())?.number?.trim() ?? "";
};

export const getContactPrimaryEmail = (contact?: Contact | null) =>
  pickPrimaryEmailRow(contact?.email_jsonb);

export const getContactPrimaryPhone = (contact?: Contact | null) =>
  pickPrimaryPhoneRow(contact?.phone_jsonb);

export const getCompanyPrimaryContactEmail = (company?: Company | null) =>
  pickPrimaryEmailRow(company?.primary_contact_email_jsonb);

export const getCompanyPrimaryContactPhone = (company?: Company | null) =>
  pickPrimaryPhoneRow(company?.primary_contact_phone_jsonb);

/** Company billing cascade: invoice override → company channels → primary contact → business email. */
export const resolveCompanyBillingEmail = (company?: Company | null): string => {
  if (!company) return "";
  const ctx = parseLbsClientContextLinks(company.context_links);
  if (ctx.invoiceEmail?.trim()) return ctx.invoiceEmail.trim();
  const companyChannel = pickPrimaryEmailRow(ctx.companyEmails);
  if (companyChannel) return companyChannel;
  const primaryContact = getCompanyPrimaryContactEmail(company);
  if (primaryContact) return primaryContact;
  if (ctx.businessEmail?.trim()) return ctx.businessEmail.trim();
  return "";
};

/** Company billing cascade: invoice override → company channels → primary contact → legacy phone. */
export const resolveCompanyBillingPhone = (company?: Company | null): string => {
  if (!company) return "";
  const ctx = parseLbsClientContextLinks(company.context_links);
  if (ctx.invoicePhone?.trim()) return ctx.invoicePhone.trim();
  const companyChannel = pickPrimaryPhoneRow(ctx.companyPhones);
  if (companyChannel) return companyChannel;
  const primaryContact = getCompanyPrimaryContactPhone(company);
  if (primaryContact) return primaryContact;
  if (company.phone_number?.trim()) return company.phone_number.trim();
  return "";
};

export type BillingRecipientContext = {
  company?: Company | null;
  contact?: Contact | null;
  ticketRequesterEmail?: string | null;
  fallbackEmail?: string | null;
};

/**
 * Unified billing recipient email (Option A):
 * company billing → linked contact → ticket requester → stored fallback.
 */
export const resolveBillingRecipientEmail = ({
  company,
  contact,
  ticketRequesterEmail,
  fallbackEmail,
}: BillingRecipientContext): string => {
  const companyEmail = resolveCompanyBillingEmail(company);
  if (companyEmail) return companyEmail;

  const contactEmail = getContactPrimaryEmail(contact);
  if (contactEmail) return contactEmail;

  const requester = ticketRequesterEmail?.trim();
  if (requester) return requester;

  return fallbackEmail?.trim() ?? "";
};

export type BillingRecipientPhoneContext = {
  company?: Company | null;
  contact?: Contact | null;
};

/** Unified billing recipient phone (Option A): company billing → linked contact. */
export const resolveBillingRecipientPhone = ({
  company,
  contact,
}: BillingRecipientPhoneContext): string => {
  const companyPhone = resolveCompanyBillingPhone(company);
  if (companyPhone) return companyPhone;
  return getContactPrimaryPhone(contact);
};
