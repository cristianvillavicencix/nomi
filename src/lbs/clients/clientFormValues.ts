import type { Contact } from "@/components/atomic-crm/types";
import type { ClientCreateFormValues } from "@/lbs/clients/ClientCreateForm";
import { parseLbsClientContextLinks } from "@/lbs/clients/clientContextLinks";
import {
  emailsToFormValues,
  mergeClientSocialLinksForForm,
  phonesToFormValues,
} from "@/lbs/clients/clientChannels";
import {
  collectCompanySocialLinks,
  collectContactSocialLinks,
} from "@/lbs/clients/clientSocialLinks";
import type { CompanyWithPrimaryContact } from "@/lbs/clients/clientProfile";

export const companyToClientFormValues = (
  company: CompanyWithPrimaryContact,
  primaryContact?: Contact | null,
): ClientCreateFormValues => {
  const ctx = parseLbsClientContextLinks(company.context_links);
  const billing = ctx.billingAddress ?? {};
  const billingSameAsBusiness = ctx.billingSameAsBusiness !== false;
  const invoiceSameAsPrimary = ctx.invoiceSameAsPrimary !== false;

  const primaryName = primaryContact
    ? `${primaryContact.first_name ?? ""} ${primaryContact.last_name ?? ""}`.trim()
    : `${company.primary_contact_first_name ?? ""} ${company.primary_contact_last_name ?? ""}`.trim();

  return {
    primary_full_name: primaryName,
    primary_emails: emailsToFormValues(
      primaryContact?.email_jsonb ?? company.primary_contact_email_jsonb,
    ),
    primary_phones: phonesToFormValues(
      primaryContact?.phone_jsonb ?? company.primary_contact_phone_jsonb,
    ),
    primary_address: primaryContact?.address?.trim() ?? "",
    company_name: company.name?.trim() ?? "",
    company_emails: emailsToFormValues(ctx.companyEmails, ctx.businessEmail),
    company_phones: phonesToFormValues(ctx.companyPhones, company.phone_number),
    company_website: company.website?.trim() ?? "",
    social_links: mergeClientSocialLinksForForm(
      collectCompanySocialLinks(company),
      collectContactSocialLinks(primaryContact, company.context_links),
    ),
    company_same_as_primary_address: isCompanySameAsPrimaryAddress(
      company,
      primaryContact,
    ),
    company_address: company.address?.trim() ?? "",
    company_city: company.city?.trim() ?? "",
    company_state_abbr: company.state_abbr?.trim() ?? "",
    company_zipcode: company.zipcode?.trim() ?? "",
    company_country: company.country?.trim() ?? "",
    billing_same_as_business: billingSameAsBusiness,
    billing_address: billing.address?.trim() ?? "",
    billing_city: billing.city?.trim() ?? "",
    billing_state_abbr: billing.stateAbbr?.trim() ?? "",
    billing_zipcode: billing.zipcode?.trim() ?? "",
    billing_country: billing.country?.trim() ?? "",
    invoice_same_as_primary: invoiceSameAsPrimary,
    invoice_contact_name: ctx.invoiceContactName ?? "",
    invoice_email: ctx.invoiceEmail ?? "",
    invoice_phone: ctx.invoicePhone ?? "",
    primary_lead_source:
      primaryContact?.lead_source?.trim() ??
      company.primary_contact_lead_source?.trim() ??
      "",
    interested_service:
      primaryContact?.interested_service?.trim() ??
      company.primary_contact_interested_service?.trim() ??
      "",
    notes: company.description?.trim() ?? "",
  };
};

const isCompanySameAsPrimaryAddress = (
  company: CompanyWithPrimaryContact,
  primaryContact?: Contact | null,
) => {
  const primaryAddress = primaryContact?.address?.trim() ?? "";
  const companyAddress = company.address?.trim() ?? "";
  const hasStructuredFields = Boolean(
    company.city?.trim() ||
      company.state_abbr?.trim() ||
      company.zipcode?.trim() ||
      company.country?.trim(),
  );

  if (!primaryAddress || !companyAddress) return false;
  if (hasStructuredFields) return false;
  return primaryAddress === companyAddress;
};

export const emptyClientFormValues = (): ClientCreateFormValues => ({
  primary_full_name: "",
  primary_emails: [{ value: "", type: "Work", isPrimary: true }],
  primary_phones: [{ value: "", type: "Work", isPrimary: true }],
  primary_address: "",
  company_name: "",
  company_emails: [{ value: "", type: "Work", isPrimary: true }],
  company_phones: [{ value: "", type: "Work", isPrimary: true }],
  company_website: "",
  social_links: [],
  company_same_as_primary_address: false,
  company_address: "",
  company_city: "",
  company_state_abbr: "",
  company_zipcode: "",
  company_country: "",
  billing_same_as_business: true,
  billing_address: "",
  billing_city: "",
  billing_state_abbr: "",
  billing_zipcode: "",
  billing_country: "",
  invoice_same_as_primary: true,
  invoice_contact_name: "",
  invoice_email: "",
  invoice_phone: "",
  primary_lead_source: "",
  interested_service: "",
  notes: "",
});
