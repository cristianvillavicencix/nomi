import type { Contact } from "@/components/atomic-crm/types";
import type { ClientCreateFormValues } from "@/lbs/clients/ClientCreateForm";
import { parseLbsClientContextLinks } from "@/lbs/clients/clientContextLinks";
import { mergeClientSocialLinksForForm } from "@/lbs/clients/clientChannels";
import {
  resolveCompanyOwnEmails,
  resolveCompanyOwnPhones,
} from "@/lbs/clients/companyChannelResolvers";
import {
  collectCompanySocialLinks,
  collectContactSocialLinks,
} from "@/lbs/clients/clientSocialLinks";
import type { CompanyWithPrimaryContact } from "@/lbs/clients/clientProfile";

const pickPrimaryEmail = (contact?: Contact | null) =>
  contact?.email_jsonb?.find((e) => e.email?.trim())?.email?.trim() ?? "";

const pickPrimaryPhone = (contact?: Contact | null) =>
  contact?.phone_jsonb?.find((p) => p.number?.trim())?.number?.trim() ?? "";

const trimOrEmpty = (value?: string | null) => value?.trim() ?? "";

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
    primary_email: pickPrimaryEmail(primaryContact),
    primary_phone: pickPrimaryPhone(primaryContact),
    selected_primary_contact_id:
      primaryContact?.id ?? company.primary_contact_id ?? null,
    company_name: company.name?.trim() ?? "",
    company_emails: resolveCompanyOwnEmails(company.context_links),
    company_phones: resolveCompanyOwnPhones(
      company.context_links,
      company.phone_number,
    ),
    company_website: company.website?.trim() ?? "",
    company_sector: company.sector?.trim() ?? "",
    social_links: (() => {
      const links = mergeClientSocialLinksForForm(
        collectCompanySocialLinks(company),
        collectContactSocialLinks(primaryContact, company.context_links),
      );
      return links.length > 0 ? links : [{ url: "" }];
    })(),
    company_address: trimOrEmpty(company.address),
    company_city: trimOrEmpty(company.city),
    company_state_abbr: trimOrEmpty(company.state_abbr),
    company_zipcode: trimOrEmpty(company.zipcode),
    company_country: trimOrEmpty(company.country),
    billing_same_as_business: billingSameAsBusiness,
    billing_address: trimOrEmpty(billing.address),
    billing_city: trimOrEmpty(billing.city),
    billing_state_abbr: trimOrEmpty(billing.stateAbbr),
    billing_zipcode: trimOrEmpty(billing.zipcode),
    billing_country: trimOrEmpty(billing.country),
    invoice_same_as_primary: invoiceSameAsPrimary,
    invoice_contact_name: ctx.invoiceContactName ?? "",
    invoice_email: ctx.invoiceEmail ?? "",
    invoice_phone: ctx.invoicePhone ?? "",
    notes: company.description?.trim() ?? "",
  };
};

export const emptyClientFormValues = (): ClientCreateFormValues => ({
  primary_full_name: "",
  primary_email: "",
  primary_phone: "",
  selected_primary_contact_id: null,
  company_name: "",
  company_emails: [{ value: "", type: "Work", isPrimary: true }],
  company_phones: [{ value: "", type: "Work", isPrimary: true }],
  company_website: "",
  company_sector: "",
  social_links: [{ url: "" }],
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
  notes: "",
});
