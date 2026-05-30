import type { Identifier } from "ra-core";
import {
  buildLbsClientContextLinks,
  type LbsBillingAddress,
} from "@/lbs/clients/clientContextLinks";
import {
  formatCompanyAddressForPrimary,
  splitClientFullName,
} from "@/lbs/clients/ClientCreateForm";
import {
  cleanChannelFormValues,
  formValuesToEmailJsonb,
  formValuesToPhoneJsonb,
  getPrimaryChannelValue,
} from "@/lbs/clients/clientChannels";
import {
  cleanSocialLinksForSave,
  findLinkedinUrl,
} from "@/lbs/clients/clientSocialLinks";
import type { ClientSocialLinkValue } from "@/lbs/clients/clientSocialLinks";
import { LBS_CLIENT_STATUS } from "@/lbs/navigation";
import type { ClientChannelFormValue } from "@/lbs/clients/clientChannels";

export type LbsClientUpsertInput = {
  organizationMemberId: Identifier;
  /** When editing an existing client, pass the company id explicitly. */
  companyId?: Identifier;
  /** When editing, pass the current primary contact id. */
  primaryContactId?: Identifier;
  primary: {
    fullName: string;
    emails?: ClientChannelFormValue[];
    phones?: ClientChannelFormValue[];
    address?: string;
  };
  business: {
    name: string;
    emails?: ClientChannelFormValue[];
    phones?: ClientChannelFormValue[];
    website?: string;
    sector?: string;
    socialLinks?: ClientSocialLinkValue[];
    address?: string;
    city?: string;
    stateAbbr?: string;
    zipcode?: string;
    country?: string;
    notes?: string;
  };
  billing: {
    sameAsBusiness: boolean;
    address?: string;
    city?: string;
    stateAbbr?: string;
    zipcode?: string;
    country?: string;
    invoiceSameAsPrimary: boolean;
    invoiceContactName?: string;
    invoiceEmail?: string;
    invoicePhone?: string;
  };
};

export type LbsClientUpsertResult = {
  company_id: Identifier;
  contact_id: Identifier;
  created: boolean;
};

export type QuickCreateClientInput = {
  businessName: string;
  contactName: string;
  email?: string;
  phone?: string;
};

export const buildQuickClientUpsertInput = (
  values: QuickCreateClientInput,
  organizationMemberId: Identifier,
): LbsClientUpsertInput => {
  const emails = values.email?.trim()
    ? [{ value: values.email.trim(), type: "Work" as const, isPrimary: true }]
    : [];
  const phones = values.phone?.trim()
    ? [{ value: values.phone.trim(), type: "Work" as const, isPrimary: true }]
    : [];

  return {
    organizationMemberId,
    primary: {
      fullName: values.contactName.trim(),
      emails,
      phones,
    },
    business: {
      name: values.businessName.trim(),
      emails,
      phones,
    },
    billing: {
      sameAsBusiness: true,
      invoiceSameAsPrimary: true,
    },
  };
};

export const normalizeWebsite = (website?: string | null) => {
  const trimmed = website?.trim();
  if (!trimmed) return null;
  return trimmed.startsWith("http") ? trimmed : `https://${trimmed}`;
};

export const buildCompanyPayloadFromUpsert = (
  input: LbsClientUpsertInput,
  existingLinks?: string[] | null,
) => {
  const billingAddress: LbsBillingAddress | undefined = input.billing
    .sameAsBusiness
    ? undefined
    : {
        address: input.billing.address?.trim() || undefined,
        city: input.billing.city?.trim() || undefined,
        stateAbbr: input.billing.stateAbbr?.trim() || undefined,
        zipcode: input.billing.zipcode?.trim() || undefined,
        country: input.billing.country?.trim() || undefined,
      };

  const companyEmails = formValuesToEmailJsonb(input.business.emails);
  const companyPhones = formValuesToPhoneJsonb(input.business.phones);
  const companySocialLinks = cleanSocialLinksForSave(
    input.business.socialLinks,
  );

  return {
    name: input.business.name.trim(),
    phone_number: getPrimaryChannelValue(input.business.phones) || null,
    website: normalizeWebsite(input.business.website),
    sector: input.business.sector?.trim() || null,
    linkedin_url: normalizeWebsite(findLinkedinUrl(companySocialLinks)),
    address: input.business.address?.trim() || null,
    city: input.business.city?.trim() || null,
    state_abbr: input.business.stateAbbr?.trim() || null,
    zipcode: input.business.zipcode?.trim() || null,
    country: input.business.country?.trim() || null,
    description: input.business.notes?.trim() || null,
    organization_member_id: input.organizationMemberId,
    context_links: buildLbsClientContextLinks(
      {
        businessEmail: getPrimaryChannelValue(input.business.emails),
        companyEmails,
        companyPhones,
        billingSameAsBusiness: input.billing.sameAsBusiness,
        billingAddress,
        invoiceSameAsPrimary: input.billing.invoiceSameAsPrimary,
        invoiceContactName: input.billing.invoiceContactName,
        invoiceEmail: input.billing.invoiceEmail,
        invoicePhone: input.billing.invoicePhone,
        companySocialLinks,
      },
      existingLinks,
    ),
  };
};

export const buildContactPayloadFromUpsert = (
  input: LbsClientUpsertInput,
  companyId: Identifier,
) => {
  const { firstName, lastName } = splitClientFullName(input.primary.fullName);
  const now = new Date().toISOString();

  return {
    first_name: firstName,
    last_name: lastName || firstName,
    company_id: companyId,
    status: LBS_CLIENT_STATUS,
    email_jsonb: formValuesToEmailJsonb(input.primary.emails),
    phone_jsonb: formValuesToPhoneJsonb(input.primary.phones),
    address: input.primary.address?.trim() || null,
    linkedin_url: null,
    lead_source: null,
    interested_service: null,
    organization_member_id: input.organizationMemberId,
    first_seen: now,
    last_seen: now,
    tags: [],
  };
};

export const clientCreateFormValuesToUpsertInput = (
  values: import("@/lbs/clients/ClientCreateForm").ClientCreateFormValues,
  organizationMemberId: Identifier,
): LbsClientUpsertInput => ({
  organizationMemberId,
  primary: {
    fullName: values.primary_full_name,
    emails: cleanChannelFormValues(values.primary_emails),
    phones: cleanChannelFormValues(values.primary_phones),
    address: values.primary_same_as_company_address
      ? formatCompanyAddressForPrimary(values)
      : values.primary_address,
  },
  business: {
    name: values.company_name,
    emails: cleanChannelFormValues(values.company_emails),
    phones: cleanChannelFormValues(values.company_phones),
    website: values.company_website,
    sector: values.company_sector,
    socialLinks: values.social_links,
    address: values.company_address,
    city: values.company_city,
    stateAbbr: values.company_state_abbr,
    zipcode: values.company_zipcode,
    country: values.company_country,
    notes: values.notes,
  },
  billing: {
    sameAsBusiness: values.billing_same_as_business,
    address: values.billing_address,
    city: values.billing_city,
    stateAbbr: values.billing_state_abbr,
    zipcode: values.billing_zipcode,
    country: values.billing_country,
    invoiceSameAsPrimary: values.invoice_same_as_primary,
    invoiceContactName: values.invoice_contact_name,
    invoiceEmail: values.invoice_email,
    invoicePhone: values.invoice_phone,
  },
});

export { splitClientFullName } from "@/lbs/clients/ClientCreateForm";
