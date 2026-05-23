import type {
  Company,
  Contact,
  EmailAndType,
  PhoneNumberAndType,
} from "@/components/atomic-crm/types";
import {
  getBusinessEmailFromLinks,
  getInvoiceContactSummary,
  parseLbsClientContextLinks,
} from "@/lbs/clients/clientContextLinks";

export type CompanyWithPrimaryContact = Company & {
  primary_contact_id?: Contact["id"] | null;
  primary_contact_first_name?: string | null;
  primary_contact_last_name?: string | null;
  primary_contact_status?: string | null;
  primary_contact_email_jsonb?: EmailAndType[] | null;
  primary_contact_phone_jsonb?: PhoneNumberAndType[] | null;
  primary_contact_lead_source?: string | null;
  primary_contact_interested_service?: string | null;
};

const pickFirstEmail = (emails?: EmailAndType[] | null) =>
  emails?.find((entry) => String(entry.email ?? "").trim())?.email?.trim() ??
  "";

const pickFirstPhone = (phones?: PhoneNumberAndType[] | null) =>
  phones?.find((entry) => String(entry.number ?? "").trim())?.number?.trim() ??
  "";

export const getPrimaryContactFullName = (
  company: CompanyWithPrimaryContact,
) => {
  const fullName =
    `${company.primary_contact_first_name ?? ""} ${company.primary_contact_last_name ?? ""}`.trim();
  return fullName || "—";
};

export const getPrimaryContactEmail = (company: CompanyWithPrimaryContact) =>
  pickFirstEmail(company.primary_contact_email_jsonb) || "—";

export const getPrimaryContactEmailFromContact = (contact?: Contact | null) =>
  pickFirstEmail(contact?.email_jsonb) || "—";

export type ClientEmailEntry = {
  label: string;
  email: string;
};

export const collectClientEmails = (
  company: CompanyWithPrimaryContact,
  primaryContact?: Contact | null,
): ClientEmailEntry[] => {
  const seen = new Set<string>();
  const entries: ClientEmailEntry[] = [];

  const add = (email: string | undefined | null, label: string) => {
    const trimmed = email?.trim();
    if (!trimmed) return;
    const key = trimmed.toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);
    entries.push({ label, email: trimmed });
  };

  const contactEmails =
    primaryContact?.email_jsonb ?? company.primary_contact_email_jsonb;
  contactEmails?.forEach((entry) => {
    const typeLabel = entry.type ? ` (${entry.type})` : "";
    add(entry.email, `Contact${typeLabel}`);
  });

  const ctx = parseLbsClientContextLinks(company.context_links);
  if (ctx.companyEmails?.length) {
    ctx.companyEmails.forEach((entry) => {
      const typeLabel = entry.type ? ` (${entry.type})` : "";
      add(entry.email, `Business${typeLabel}`);
    });
  } else {
    add(getBusinessEmailFromLinks(company.context_links), "Business");
  }

  const invoice = getInvoiceContactSummary(company);
  if (invoice.email !== "—") {
    add(invoice.email, "Invoice");
  }

  return entries;
};

export const getExtraClientEmails = (
  company: CompanyWithPrimaryContact,
  primaryContact?: Contact | null,
  displayedEmail?: string,
) => {
  const all = collectClientEmails(company, primaryContact);
  const normalizedDisplayed = displayedEmail?.trim().toLowerCase();
  if (!normalizedDisplayed) {
    return all.length > 1 ? all.slice(1) : all;
  }
  return all.filter(
    (entry) => entry.email.toLowerCase() !== normalizedDisplayed,
  );
};

export {
  collectBusinessSocialLinks,
  collectPrimaryContactSocialLinks,
  type ClientSocialLink,
} from "@/lbs/clients/clientSocialLinks";

export const getPrimaryContactPhone = (company: CompanyWithPrimaryContact) =>
  pickFirstPhone(company.primary_contact_phone_jsonb) ||
  company.phone_number?.trim() ||
  "—";

export const formatCompanyAddress = (company: CompanyWithPrimaryContact) => {
  const parts = [
    company.address,
    [company.city, company.state_abbr].filter(Boolean).join(", "),
    company.zipcode,
    company.country,
  ]
    .map((part) => String(part ?? "").trim())
    .filter(Boolean);

  return parts.length ? parts.join(" · ") : "—";
};

export const getClientStatus = (company: CompanyWithPrimaryContact) =>
  company.primary_contact_status?.trim() || "—";

export const formatClientHeaderAddress = (
  company: CompanyWithPrimaryContact,
  contactAddress?: string | null,
) => {
  const structured = [
    company.address,
    [company.city, company.state_abbr].filter(Boolean).join(", "),
    company.zipcode,
  ]
    .map((part) => String(part ?? "").trim())
    .filter(Boolean)
    .join(", ");

  if (structured) return structured;

  const fallback = String(contactAddress ?? "").trim();
  return fallback || formatCompanyAddress(company).replace(/ · /g, ", ");
};

export const pickPrimaryContact = (
  company: Pick<Company, "id" | "primary_contact_id">,
  contacts: Contact[],
): Contact | undefined => {
  if (company.primary_contact_id) {
    const explicit = contacts.find(
      (contact) => String(contact.id) === String(company.primary_contact_id),
    );
    if (explicit) return explicit;
  }

  const companyContacts = contacts.filter(
    (contact) => String(contact.company_id) === String(company.id),
  );

  if (companyContacts.length === 0) return undefined;

  return [...companyContacts].sort((left, right) => {
    const leftIsClient = left.status === "client" ? 0 : 1;
    const rightIsClient = right.status === "client" ? 0 : 1;
    if (leftIsClient !== rightIsClient) return leftIsClient - rightIsClient;

    const leftCreated = left.first_seen
      ? Date.parse(left.first_seen)
      : Number.MAX_SAFE_INTEGER;
    const rightCreated = right.first_seen
      ? Date.parse(right.first_seen)
      : Number.MAX_SAFE_INTEGER;
    if (leftCreated !== rightCreated) return leftCreated - rightCreated;

    return Number(left.id) - Number(right.id);
  })[0];
};

export const enrichCompanySummary = (
  company: Company,
  contacts: Contact[],
): CompanyWithPrimaryContact => {
  const primaryContact = pickPrimaryContact(company, contacts);

  if (!primaryContact) {
    return company;
  }

  return {
    ...company,
    primary_contact_id: primaryContact.id,
    primary_contact_first_name: primaryContact.first_name,
    primary_contact_last_name: primaryContact.last_name,
    primary_contact_status: primaryContact.status,
    primary_contact_email_jsonb: primaryContact.email_jsonb,
    primary_contact_phone_jsonb: primaryContact.phone_jsonb,
    primary_contact_lead_source: primaryContact.lead_source,
    primary_contact_interested_service: primaryContact.interested_service,
  };
};
