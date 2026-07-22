import type { Company, Contact } from "@/components/atomic-crm/types";
import type { BillToSelection } from "@/modules/billing/BillToClientSearch";
import { parseLbsClientContextLinks } from "@/modules/clients/clientContextLinks";
import {
  formatUsPhoneDisplayFromAny,
  isValidUsPhone,
  normalizeUsPhoneToE164,
} from "@/utils/phone";

export const formatContactName = (contact?: Contact | null) =>
  [contact?.first_name, contact?.last_name].filter(Boolean).join(" ") || null;

export const formatOrganizationMemberName = (
  member?: {
    first_name?: string | null;
    last_name?: string | null;
    email?: string | null;
  } | null,
) => {
  const name = [member?.first_name, member?.last_name]
    .filter(Boolean)
    .join(" ");
  return name || member?.email?.trim() || null;
};

export const getContactEmail = (contact?: Contact | null) =>
  contact?.email_jsonb?.find((row) => row.email?.trim())?.email?.trim() ?? "";

export const getContactPhone = (contact?: Contact | null) =>
  contact?.phone_jsonb?.find((row) => row.number?.trim())?.number?.trim() ?? "";

const getPrimaryContactEmail = (company?: Company | null) => {
  const rows = company?.primary_contact_email_jsonb ?? [];
  return rows.find((row) => row.email?.trim())?.email?.trim() ?? "";
};

const getPrimaryContactPhone = (company?: Company | null) => {
  const rows = company?.primary_contact_phone_jsonb ?? [];
  return rows.find((row) => row.number?.trim())?.number?.trim() ?? "";
};

export type BillToDisplay = {
  companyName: string | null;
  contactName: string | null;
  addressLines: string[];
  email: string | null;
  phone: string | null;
};

type AddressParts = {
  address?: string | null;
  city?: string | null;
  stateAbbr?: string | null;
  zipcode?: string | null;
  country?: string | null;
};

const addressLineLooksComplete = (
  address: string,
  city?: string | null,
  state?: string | null,
  zip?: string | null,
) => {
  const normalized = address.toLowerCase();
  if (zip?.trim() && normalized.includes(zip.trim().toLowerCase())) {
    return true;
  }
  const cityPart = city?.trim().toLowerCase();
  const statePart = state?.trim().toLowerCase();
  if (
    cityPart &&
    statePart &&
    normalized.includes(cityPart) &&
    normalized.includes(statePart)
  ) {
    return true;
  }
  return false;
};

/** Invoice bill-to: at most two lines — street, then city/state/zip/country. */
export const buildBillToAddressLines = (parts: AddressParts): string[] => {
  const street = parts.address?.trim();
  if (!street) return [];

  const city = parts.city?.trim();
  const state = parts.stateAbbr?.trim();
  const zip = parts.zipcode?.trim();
  const country = parts.country?.trim();

  const countryAlreadyShown = (text: string) =>
    Boolean(country && text.toLowerCase().includes(country.toLowerCase()));

  if (addressLineLooksComplete(street, city, state, zip)) {
    if (country && !countryAlreadyShown(street)) {
      return [street, country];
    }
    return [street];
  }

  const locality = [city, state, zip].filter(Boolean).join(", ");
  const secondLine = [
    locality || null,
    country && !countryAlreadyShown(street) && !countryAlreadyShown(locality)
      ? country
      : null,
  ]
    .filter(Boolean)
    .join(", ");

  return secondLine ? [street, secondLine] : [street];
};

export const resolveBillToDisplay = (
  company?: Company | null,
  contact?: Contact | null,
): BillToDisplay => {
  const ctx = parseLbsClientContextLinks(company?.context_links);

  const companyName = company?.name?.trim() || null;
  const linkedContactName = formatContactName(contact)?.trim() || null;
  const contactName =
    linkedContactName ||
    ctx.invoiceContactName?.trim() ||
    (company?.primary_contact_first_name
      ? [company.primary_contact_first_name, company.primary_contact_last_name]
          .filter(Boolean)
          .join(" ")
      : null);

  const addressLines: string[] = [];
  const billing = ctx.billingAddress;
  if (billing?.address?.trim()) {
    addressLines.push(
      ...buildBillToAddressLines({
        address: billing.address,
        city: billing.city,
        stateAbbr: billing.stateAbbr,
        zipcode: billing.zipcode,
        country: billing.country,
      }),
    );
  } else if (company?.address?.trim()) {
    addressLines.push(
      ...buildBillToAddressLines({
        address: company.address,
        city: company.city,
        stateAbbr: company.state_abbr,
        zipcode: company.zipcode,
        country: company.country,
      }),
    );
  } else if (contact?.address?.trim()) {
    addressLines.push(contact.address.trim());
  }

  const email =
    ctx.invoiceEmail?.trim() ||
    getContactEmail(contact) ||
    getPrimaryContactEmail(company) ||
    ctx.businessEmail?.trim() ||
    null;

  const phone =
    ctx.invoicePhone?.trim() ||
    getContactPhone(contact) ||
    getPrimaryContactPhone(company) ||
    company?.phone_number?.trim() ||
    null;

  return {
    companyName,
    contactName: contactName || null,
    addressLines,
    email,
    phone,
  };
};

/** Invoice bill-to heading: `Contact | Company` when both differ. */
export const formatBillToNameLine = (
  company?: Company | null,
  contact?: Contact | null,
): string | null => {
  const { contactName, companyName } = resolveBillToDisplay(company, contact);
  const contactLabel = contactName?.trim() || null;
  const companyLabel = companyName?.trim() || null;

  if (contactLabel && companyLabel && contactLabel !== companyLabel) {
    return `${contactLabel} | ${companyLabel}`;
  }

  return contactLabel || companyLabel;
};

export const resolveInvoiceRecipientEmail = ({
  company,
  contact,
  fallbackEmail,
}: {
  company?: Company | null;
  contact?: Contact | null;
  fallbackEmail?: string | null;
}) => {
  const display = resolveBillToDisplay(company, contact);
  if (display.email) return display.email;
  if (fallbackEmail?.trim()) return fallbackEmail.trim();
  return "";
};

export const resolveInvoiceRecipientPhone = ({
  company,
  contact,
}: {
  company?: Company | null;
  contact?: Contact | null;
}) => {
  const display = resolveBillToDisplay(company, contact);
  return display.phone?.trim() ?? "";
};

/** Ticket invoices bill a specific contact — prefer their phone over company billing overrides. */
export const resolveTicketInvoiceRecipientPhone = ({
  company,
  contact,
}: {
  company?: Company | null;
  contact?: Contact | null;
}) => {
  const contactPhone = getContactPhone(contact);
  if (contactPhone) return contactPhone;
  return resolveInvoiceRecipientPhone({ company, contact });
};

const invoiceEmailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const splitInvoiceListInput = (value: string) =>
  value
    .split(/[,;]/)
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0);

export const parseInvoiceEmailList = (value: string) =>
  splitInvoiceListInput(value)
    .map((entry) => entry.toLowerCase())
    .filter((entry) => invoiceEmailPattern.test(entry));

export const getInvalidInvoiceEmails = (value: string) =>
  splitInvoiceListInput(value).filter(
    (entry) => !invoiceEmailPattern.test(entry.toLowerCase()),
  );

export const parseInvoicePhoneList = (value: string) => {
  const seen = new Set<string>();
  const phones: string[] = [];
  for (const entry of splitInvoiceListInput(value)) {
    const e164 = normalizeUsPhoneToE164(entry);
    if (!e164 || seen.has(e164)) continue;
    seen.add(e164);
    phones.push(e164);
  }
  return phones;
};

export const getInvalidInvoicePhones = (value: string) =>
  splitInvoiceListInput(value).filter((entry) => !isValidUsPhone(entry));

export const formatInvoicePhoneListInput = (value: string): string => {
  const parts = splitInvoiceListInput(value);
  if (parts.length === 0) return value.trim();
  return parts
    .map((part) => {
      const formatted = formatUsPhoneDisplayFromAny(part);
      return formatted === "—" ? part : formatted;
    })
    .join(", ");
};

export const billToSelectionFromClient = ({
  company,
  contact,
}: {
  company?: Company | null;
  contact?: Contact | null;
}): BillToSelection | null => {
  if (!company && !contact) return null;
  const companyName = company?.name?.trim();
  const contactName = formatContactName(contact);
  const label = companyName ?? contactName ?? "Client";
  return {
    companyId:
      company?.id != null ? Number(company.id) : (contact?.company_id ?? null),
    contactId: contact?.id != null ? Number(contact.id) : null,
    label,
    company: company ?? null,
    contact: contact ?? null,
  };
};

export const canEditClientInvoice = (invoice: { status?: string | null }) =>
  invoice.status === "draft" || invoice.status === "sent";

export const canViewClientInvoiceDetail = (invoice: {
  status?: string | null;
}) =>
  invoice.status === "draft" ||
  invoice.status === "sent" ||
  invoice.status === "paid";

export const canMarkClientInvoiceSent = (invoice: { status?: string | null }) =>
  invoice.status === "draft";

export const canSendClientInvoice = (invoice: { status?: string | null }) =>
  invoice.status === "draft" || invoice.status === "sent";

export const canVoidClientInvoice = (invoice: { status?: string | null }) =>
  invoice.status !== "void" && invoice.status !== "paid";

export const canDeleteClientInvoice = (invoice: {
  status?: string | null;
  installment_id?: unknown;
}) => invoice.status === "draft" && invoice.installment_id == null;
