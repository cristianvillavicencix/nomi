import type {
  EmailAndType,
  PhoneNumberAndType,
} from "@/components/atomic-crm/types";
import { parseLbsClientContextLinks } from "@/lbs/clients/clientContextLinks";
import {
  companyEmailsToFormValues,
  companyPhonesToFormValues,
  type ClientChannelFormValue,
} from "@/lbs/clients/clientChannels";

const pickFirstEmail = (emails?: EmailAndType[] | null) =>
  emails?.find((entry) => String(entry.email ?? "").trim())?.email?.trim() ??
  "";

const pickFirstPhone = (phones?: PhoneNumberAndType[] | null) =>
  phones?.find((entry) => String(entry.number ?? "").trim())?.number?.trim() ??
  "";

export type CompanyChannelDisplaySource = {
  context_links?: string[] | null;
  phone_number?: string | null;
  primary_contact_email_jsonb?: EmailAndType[] | null;
  primary_contact_phone_jsonb?: PhoneNumberAndType[] | null;
};

/** Display-only cascade for list and profile. */
export const resolveCompanyEmailForDisplay = (
  company: CompanyChannelDisplaySource,
): string => {
  const ctx = parseLbsClientContextLinks(company.context_links);
  if (ctx.businessEmail?.trim()) return ctx.businessEmail.trim();
  const fromCompanyEmails = ctx.companyEmails?.find((entry) =>
    entry.email?.trim(),
  )?.email?.trim();
  if (fromCompanyEmails) return fromCompanyEmails;
  const primary = pickFirstEmail(company.primary_contact_email_jsonb);
  if (primary) return primary;
  if (ctx.invoiceEmail?.trim()) return ctx.invoiceEmail.trim();
  return "—";
};

/** Own company keys only — hydrates the edit form Email field. */
export const resolveCompanyOwnEmails = (
  contextLinks?: string[] | null,
): ClientChannelFormValue[] => {
  const ctx = parseLbsClientContextLinks(contextLinks);
  return companyEmailsToFormValues(ctx.companyEmails, ctx.businessEmail);
};

/** Display-only cascade for list and profile. */
export const resolveCompanyPhoneForDisplay = (
  company: CompanyChannelDisplaySource,
): string => {
  const ctx = parseLbsClientContextLinks(company.context_links);
  if (company.phone_number?.trim()) return company.phone_number.trim();
  const fromCompanyPhones = ctx.companyPhones?.find((entry) =>
    entry.number?.trim(),
  )?.number?.trim();
  if (fromCompanyPhones) return fromCompanyPhones;
  const primary = pickFirstPhone(company.primary_contact_phone_jsonb);
  if (primary) return primary;
  if (ctx.invoicePhone?.trim()) return ctx.invoicePhone.trim();
  return "—";
};

/** Own company keys only — hydrates the edit form Phone field. */
export const resolveCompanyOwnPhones = (
  contextLinks?: string[] | null,
  phoneNumber?: string | null,
): ClientChannelFormValue[] =>
  companyPhonesToFormValues(
    parseLbsClientContextLinks(contextLinks).companyPhones,
    phoneNumber,
  );
