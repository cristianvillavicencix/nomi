import type { Contact } from "@/components/atomic-crm/types";
import type { ClientCreateFormValues } from "@/lbs/clients/ClientCreateForm";
import { parseLbsClientContextLinks } from "@/lbs/clients/clientContextLinks";
import {
  emailsToFormValues,
  getPrimaryChannelValue,
  mergeClientSocialLinksForForm,
  phonesToFormValues,
} from "@/lbs/clients/clientChannels";
import {
  collectCompanySocialLinks,
  collectContactSocialLinks,
} from "@/lbs/clients/clientSocialLinks";
import type { CompanyWithPrimaryContact } from "@/lbs/clients/clientProfile";

const pickPrimaryEmail = (contact?: Contact | null) =>
  getPrimaryChannelValue(
    emailsToFormValues(contact?.email_jsonb ?? undefined),
  );

const pickPrimaryPhone = (contact?: Contact | null) =>
  getPrimaryChannelValue(
    phonesToFormValues(contact?.phone_jsonb ?? undefined),
  );

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
    company_email: getPrimaryChannelValue(
      emailsToFormValues(ctx.companyEmails, ctx.businessEmail),
    ),
    company_phone: getPrimaryChannelValue(
      phonesToFormValues(ctx.companyPhones, company.phone_number),
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
    company_address: formatStructuredAddress({
      address: company.address,
      city: company.city,
      stateAbbr: company.state_abbr,
      zipcode: company.zipcode,
      country: company.country,
    }),
    billing_same_as_business: billingSameAsBusiness,
    billing_address: formatStructuredAddress({
      address: billing.address,
      city: billing.city,
      stateAbbr: billing.stateAbbr,
      zipcode: billing.zipcode,
      country: billing.country,
    }),
    invoice_same_as_primary: invoiceSameAsPrimary,
    invoice_contact_name: ctx.invoiceContactName ?? "",
    invoice_email: ctx.invoiceEmail ?? "",
    invoice_phone: ctx.invoicePhone ?? "",
    notes: company.description?.trim() ?? "",
  };
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
  [
    address?.trim() ?? "",
    [city?.trim(), [stateAbbr?.trim(), zipcode?.trim()].filter(Boolean).join(" ")]
      .filter(Boolean)
      .join(", "),
    country?.trim() ?? "",
  ]
    .filter(Boolean)
    .join("\n");

export const emptyClientFormValues = (): ClientCreateFormValues => ({
  primary_full_name: "",
  primary_email: "",
  primary_phone: "",
  selected_primary_contact_id: null,
  company_name: "",
  company_email: "",
  company_phone: "",
  company_website: "",
  company_sector: "",
  social_links: [{ url: "" }],
  company_address: "",
  billing_same_as_business: true,
  billing_address: "",
  invoice_same_as_primary: true,
  invoice_contact_name: "",
  invoice_email: "",
  invoice_phone: "",
  notes: "",
});
