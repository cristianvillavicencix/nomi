import type { Contact } from "@/components/atomic-crm/types";
import type { ClientCreateFormValues } from "@/lbs/clients/ClientCreateForm";
import { formatCompanyAddressForPrimary } from "@/lbs/clients/ClientCreateForm";
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
    company_sector: company.sector?.trim() ?? "",
    social_links: (() => {
      const links = mergeClientSocialLinksForForm(
        collectCompanySocialLinks(company),
        collectContactSocialLinks(primaryContact, company.context_links),
      );
      return links.length > 0 ? links : [{ url: "" }];
    })(),
    primary_same_as_company_address: isPrimarySameAsCompanyAddress(
      company,
      primaryContact,
    ),
    company_address: formatStructuredAddress({
      address: company.address,
      city: company.city,
      stateAbbr: company.state_abbr,
      zipcode: company.zipcode,
      country: company.country,
    }),
    company_city: "",
    company_state_abbr: "",
    company_zipcode: "",
    company_country: "",
    billing_same_as_business: billingSameAsBusiness,
    billing_address: formatStructuredAddress({
      address: billing.address,
      city: billing.city,
      stateAbbr: billing.stateAbbr,
      zipcode: billing.zipcode,
      country: billing.country,
    }),
    billing_city: "",
    billing_state_abbr: "",
    billing_zipcode: "",
    billing_country: "",
    invoice_same_as_primary: invoiceSameAsPrimary,
    invoice_contact_name: ctx.invoiceContactName ?? "",
    invoice_email: ctx.invoiceEmail ?? "",
    invoice_phone: ctx.invoicePhone ?? "",
    notes: company.description?.trim() ?? "",
  };
};

const isPrimarySameAsCompanyAddress = (
  company: CompanyWithPrimaryContact,
  primaryContact?: Contact | null,
) => {
  const primaryAddress = primaryContact?.address?.trim() ?? "";
  if (!primaryAddress) return false;

  const companyAddress = formatStructuredAddress({
    address: company.address,
    city: company.city,
    stateAbbr: company.state_abbr,
    zipcode: company.zipcode,
    country: company.country,
  });

  return Boolean(companyAddress) && primaryAddress === companyAddress;
};

const formatStructuredAddress = ({
  address,
  city,
  stateAbbr,
  zipcode,
  country,
}: {
  address?: string | null;
  city?: string | null;
  stateAbbr?: string | null;
  zipcode?: string | null;
  country?: string | null;
}) =>
  formatCompanyAddressForPrimary({
    company_address: [
      address?.trim() ?? "",
      [city?.trim(), [stateAbbr?.trim(), zipcode?.trim()].filter(Boolean).join(" ")]
        .filter(Boolean)
        .join(", "),
      country?.trim() ?? "",
    ]
      .filter(Boolean)
      .join("\n"),
  });

export const emptyClientFormValues = (): ClientCreateFormValues => ({
  primary_full_name: "",
  primary_emails: [{ value: "", type: "Work", isPrimary: true }],
  primary_phones: [{ value: "", type: "Work", isPrimary: true }],
  primary_address: "",
  company_name: "",
  company_emails: [{ value: "", type: "Work", isPrimary: true }],
  company_phones: [{ value: "", type: "Work", isPrimary: true }],
  company_website: "",
  company_sector: "",
  social_links: [{ url: "" }],
  primary_same_as_company_address: false,
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
