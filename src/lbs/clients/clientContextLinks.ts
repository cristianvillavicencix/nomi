import type { ClientSocialLinkValue } from "@/lbs/clients/clientSocialLinks";
import type {
  EmailAndType,
  PhoneNumberAndType,
} from "@/components/atomic-crm/types";

export type LbsBillingAddress = {
  address?: string;
  city?: string;
  stateAbbr?: string;
  zipcode?: string;
  country?: string;
};

export type LbsClientSocialLinks = {
  companyFacebook?: string;
  companyInstagram?: string;
  companyX?: string;
  contactFacebook?: string;
  contactInstagram?: string;
  contactX?: string;
};

export type LbsClientContextData = {
  businessEmail?: string;
  billingSameAsBusiness?: boolean;
  billingAddress?: LbsBillingAddress;
  invoiceSameAsPrimary?: boolean;
  invoiceContactName?: string;
  invoiceEmail?: string;
  invoicePhone?: string;
  companyEmails?: EmailAndType[];
  companyPhones?: PhoneNumberAndType[];
  companySocialLinks?: ClientSocialLinkValue[];
  /** @deprecated Legacy fixed social fields — used only when reading old records. */
  socialLinks?: LbsClientSocialLinks;
};

const PREFIX = "lbs:";

const setLink = (key: string, value: string) => `${PREFIX}${key}=${value}`;

const parseLink = (links: string[] | undefined, key: string) => {
  const prefix = `${PREFIX}${key}=`;
  const match = links?.find((link) => link.startsWith(prefix));
  return match ? match.slice(prefix.length) : undefined;
};

const stripLbsLinks = (links: string[] | undefined) =>
  (links ?? []).filter((link) => !link.startsWith(PREFIX));

export const parseLbsClientContextLinks = (
  links?: string[] | null,
): LbsClientContextData => {
  const normalized = links ?? undefined;
  const billingRaw = parseLink(normalized, "billing_address");

  let billingAddress: LbsBillingAddress | undefined;
  if (billingRaw) {
    try {
      billingAddress = JSON.parse(billingRaw) as LbsBillingAddress;
    } catch {
      billingAddress = { address: billingRaw };
    }
  }

  return {
    businessEmail: parseLink(normalized, "business_email"),
    billingSameAsBusiness:
      parseLink(normalized, "billing_same_as_business") === "true",
    billingAddress,
    invoiceSameAsPrimary:
      parseLink(normalized, "invoice_same_as_primary") !== "false",
    invoiceContactName: parseLink(normalized, "invoice_contact_name"),
    invoiceEmail: parseLink(normalized, "invoice_email"),
    invoicePhone: parseLink(normalized, "invoice_phone"),
    companyEmails: parseChannelsJson<EmailAndType>(
      normalized,
      "company_emails",
    ),
    companyPhones: parseChannelsJson<PhoneNumberAndType>(
      normalized,
      "company_phones",
    ),
    companySocialLinks: parseSocialLinksJson(
      normalized,
      "company_social_links",
    ),
    socialLinks: {
      companyFacebook: parseLink(normalized, "social_facebook"),
      companyInstagram: parseLink(normalized, "social_instagram"),
      companyX: parseLink(normalized, "social_x"),
      contactFacebook: parseLink(normalized, "contact_social_facebook"),
      contactInstagram: parseLink(normalized, "contact_social_instagram"),
      contactX: parseLink(normalized, "contact_social_x"),
    },
  };
};

const parseChannelsJson = <T>(
  links: string[] | undefined,
  key: string,
): T[] | undefined => {
  const raw = parseLink(links, key);
  if (!raw) return undefined;
  try {
    const parsed = JSON.parse(raw) as T[];
    return Array.isArray(parsed) ? parsed : undefined;
  } catch {
    return undefined;
  }
};

const parseSocialLinksJson = (
  links: string[] | undefined,
  key: string,
): ClientSocialLinkValue[] | undefined => {
  const raw = parseLink(links, key);
  if (!raw) return undefined;
  try {
    const parsed = JSON.parse(raw) as ClientSocialLinkValue[];
    return Array.isArray(parsed) ? parsed : undefined;
  } catch {
    return undefined;
  }
};

export const buildLbsClientContextLinks = (
  data: LbsClientContextData,
  existingLinks?: string[] | null,
): string[] => {
  const links = stripLbsLinks(existingLinks ?? undefined);

  if (data.businessEmail?.trim()) {
    links.push(setLink("business_email", data.businessEmail.trim()));
  }
  if (data.companyEmails?.length) {
    links.push(setLink("company_emails", JSON.stringify(data.companyEmails)));
  }
  if (data.companyPhones?.length) {
    links.push(setLink("company_phones", JSON.stringify(data.companyPhones)));
  }
  if (data.billingSameAsBusiness != null) {
    links.push(
      setLink(
        "billing_same_as_business",
        data.billingSameAsBusiness ? "true" : "false",
      ),
    );
  }
  if (data.billingAddress && !data.billingSameAsBusiness) {
    links.push(setLink("billing_address", JSON.stringify(data.billingAddress)));
  }
  if (data.invoiceSameAsPrimary != null) {
    links.push(
      setLink(
        "invoice_same_as_primary",
        data.invoiceSameAsPrimary ? "true" : "false",
      ),
    );
  }
  if (data.invoiceContactName?.trim()) {
    links.push(setLink("invoice_contact_name", data.invoiceContactName.trim()));
  }
  if (data.invoiceEmail?.trim()) {
    links.push(setLink("invoice_email", data.invoiceEmail.trim()));
  }
  if (data.invoicePhone?.trim()) {
    links.push(setLink("invoice_phone", data.invoicePhone.trim()));
  }

  if (data.companySocialLinks?.length) {
    links.push(
      setLink("company_social_links", JSON.stringify(data.companySocialLinks)),
    );
  }

  return links;
};

export const formatBillingAddress = (company: {
  address?: string | null;
  city?: string | null;
  state_abbr?: string | null;
  zipcode?: string | null;
  country?: string | null;
  context_links?: string[] | null;
}) => {
  const ctx = parseLbsClientContextLinks(company.context_links);
  if (ctx.billingSameAsBusiness !== false) {
    return formatAddressParts({
      address: company.address,
      city: company.city,
      stateAbbr: company.state_abbr,
      zipcode: company.zipcode,
      country: company.country,
    });
  }

  return formatAddressParts(ctx.billingAddress ?? {});
};

const formatAddressParts = (
  parts: LbsBillingAddress & {
    address?: string | null;
    city?: string | null;
    stateAbbr?: string | null;
    zipcode?: string | null;
    country?: string | null;
  },
) => {
  const segments = [
    parts.address,
    [parts.city, parts.stateAbbr].filter(Boolean).join(", "),
    parts.zipcode,
    parts.country,
  ]
    .map((part) => String(part ?? "").trim())
    .filter(Boolean);

  return segments.length ? segments.join(" · ") : "—";
};

export const getBusinessEmailFromLinks = (links?: string[] | null) =>
  parseLbsClientContextLinks(links).businessEmail?.trim() ?? "";

export const getInvoiceContactSummary = (company: {
  context_links?: string[] | null;
  primary_contact_first_name?: string | null;
  primary_contact_last_name?: string | null;
  primary_contact_email_jsonb?: { email?: string }[] | null;
  primary_contact_phone_jsonb?: { number?: string }[] | null;
}) => {
  const ctx = parseLbsClientContextLinks(company.context_links);
  if (ctx.invoiceSameAsPrimary !== false) {
    const name =
      `${company.primary_contact_first_name ?? ""} ${company.primary_contact_last_name ?? ""}`.trim();
    const email =
      company.primary_contact_email_jsonb?.find((entry) => entry.email?.trim())
        ?.email ?? "";
    const phone =
      company.primary_contact_phone_jsonb?.find((entry) => entry.number?.trim())
        ?.number ?? "";
    return { name: name || "—", email: email || "—", phone: phone || "—" };
  }

  return {
    name: ctx.invoiceContactName?.trim() || "—",
    email: ctx.invoiceEmail?.trim() || "—",
    phone: ctx.invoicePhone?.trim() || "—",
  };
};
