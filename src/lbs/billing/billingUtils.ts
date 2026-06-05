import type { Company, Contact } from "@/components/atomic-crm/types";
import type { BillToSelection } from "@/lbs/billing/BillToClientSearch";
import { parseLbsClientContextLinks } from "@/lbs/clients/clientContextLinks";

export const formatContactName = (contact?: Contact | null) =>
  [contact?.first_name, contact?.last_name].filter(Boolean).join(" ") || null;

export const formatOrganizationMemberName = (
  member?: {
    first_name?: string | null;
    last_name?: string | null;
    email?: string | null;
  } | null,
) => {
  const name = [member?.first_name, member?.last_name].filter(Boolean).join(" ");
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

/** Multi-line bill-to address without repeating city/state/country already in line 1. */
export const buildBillToAddressLines = (parts: AddressParts): string[] => {
  const street = parts.address?.trim();
  if (!street) return [];

  const city = parts.city?.trim();
  const state = parts.stateAbbr?.trim();
  const zip = parts.zipcode?.trim();
  const country = parts.country?.trim();

  if (addressLineLooksComplete(street, city, state, zip)) {
    return [street];
  }

  const lines = [street];
  const cityLine = [city, state, zip].filter(Boolean).join(", ");
  if (cityLine) lines.push(cityLine);
  if (country && !street.toLowerCase().includes(country.toLowerCase())) {
    lines.push(country);
  }
  return lines;
};

export const resolveBillToDisplay = (
  company?: Company | null,
  contact?: Contact | null,
): BillToDisplay => {
  const ctx = parseLbsClientContextLinks(company?.context_links);

  const companyName = company?.name?.trim() || null;
  const contactName =
    ctx.invoiceContactName?.trim() ||
    formatContactName(contact) ||
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
    companyId: company?.id != null ? Number(company.id) : contact?.company_id ?? null,
    contactId: contact?.id != null ? Number(contact.id) : null,
    label,
    company: company ?? null,
    contact: contact ?? null,
  };
};

export const canEditClientInvoice = (invoice: {
  status?: string | null;
}) => invoice.status === "draft" || invoice.status === "sent";

export const canMarkClientInvoiceSent = (invoice: {
  status?: string | null;
}) => invoice.status === "draft";

export const canVoidClientInvoice = (invoice: {
  status?: string | null;
}) =>
  invoice.status !== "void" &&
  invoice.status !== "paid";

export const canDeleteClientInvoice = (invoice: {
  status?: string | null;
  installment_id?: unknown;
}) => invoice.status === "draft" && invoice.installment_id == null;
