import type { Contact } from "@/components/atomic-crm/types";
import type { ClientCreateFormValues } from "@/modules/clients/ClientCreateForm";
import { parseLbsClientContextLinks } from "@/modules/clients/clientContextLinks";
import { mergeClientSocialLinksForForm } from "@/modules/clients/clientChannels";
import {
  resolveCompanyOwnEmails,
  resolveCompanyOwnPhones,
} from "@/modules/clients/companyChannelResolvers";
import {
  collectCompanySocialLinks,
  collectContactSocialLinks,
} from "@/modules/clients/clientSocialLinks";
import type { CompanyWithPrimaryContact } from "@/modules/clients/clientProfile";

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
  organization_member_id: null,
  company_size: null,
  company_revenue: "",
  tax_identifier: "",
  linkedin_url: "",
});

/** Reset streamlined create fields when company name is cleared (keeps assignee). */
export const clearStreamlinedCompanyDependentFields = (
  setValue: import("react-hook-form").UseFormSetValue<ClientCreateFormValues>,
  keepOrganizationMemberId?: ClientCreateFormValues["organization_member_id"],
) => {
  const empty = emptyClientFormValues();
  const assign = <K extends keyof ClientCreateFormValues>(
    key: K,
    value: ClientCreateFormValues[K],
  ) => setValue(key, value, { shouldDirty: true });

  assign("company_website", empty.company_website);
  assign("company_emails", empty.company_emails);
  assign("company_phones", empty.company_phones);
  assign("company_sector", empty.company_sector);
  assign("company_address", empty.company_address);
  assign("company_city", empty.company_city);
  assign("company_state_abbr", empty.company_state_abbr);
  assign("company_zipcode", empty.company_zipcode);
  assign("company_country", empty.company_country);
  assign("company_size", empty.company_size);
  assign("company_revenue", empty.company_revenue);
  assign("tax_identifier", empty.tax_identifier);
  assign("linkedin_url", empty.linkedin_url);
  assign("notes", empty.notes);
  assign("social_links", empty.social_links);
  assign("primary_full_name", empty.primary_full_name);
  assign("primary_email", empty.primary_email);
  assign("primary_phone", empty.primary_phone);
  assign("selected_primary_contact_id", empty.selected_primary_contact_id);
  assign("billing_same_as_business", empty.billing_same_as_business);
  assign("billing_address", empty.billing_address);
  assign("billing_city", empty.billing_city);
  assign("billing_state_abbr", empty.billing_state_abbr);
  assign("billing_zipcode", empty.billing_zipcode);
  assign("billing_country", empty.billing_country);
  assign("invoice_same_as_primary", empty.invoice_same_as_primary);
  assign("invoice_contact_name", empty.invoice_contact_name);
  assign("invoice_email", empty.invoice_email);
  assign("invoice_phone", empty.invoice_phone);

  if (keepOrganizationMemberId != null) {
    assign("organization_member_id", keepOrganizationMemberId);
  }
};
