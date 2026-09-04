/**
 * Shared CRM → website_brief field mapping (client + edge mirror).
 * Rule: fill only when the brief key is empty so client edits win.
 */

export type BriefPrefillContact = {
  first_name?: string | null;
  last_name?: string | null;
  email?: string | null;
  phone?: string | null;
  address?: string | null;
};

export type BriefPrefillCompany = {
  name?: string | null;
  website?: string | null;
  phone_number?: string | null;
  address?: string | null;
  city?: string | null;
  state_abbr?: string | null;
  zipcode?: string | null;
};

export const formatBriefAddress = (
  parts: Array<string | null | undefined>,
) =>
  parts
    .map((part) => part?.trim())
    .filter(Boolean)
    .join(", ");

export const isBriefValueEmpty = (value: unknown) => {
  if (value == null) return true;
  if (typeof value === "string") return value.trim().length === 0;
  if (Array.isArray(value)) return value.length === 0;
  return false;
};

export const fillBriefIfEmpty = (
  brief: Record<string, unknown>,
  key: string,
  value: string | undefined | null,
) => {
  if (value == null || value === "") return;
  if (!isBriefValueEmpty(brief[key])) return;
  brief[key] = value;
};

export const applyCrmContactCompanyToBrief = (
  brief: Record<string, unknown>,
  contact?: BriefPrefillContact | null,
  company?: BriefPrefillCompany | null,
) => {
  if (contact) {
    fillBriefIfEmpty(brief, "contact_first_name", contact.first_name);
    fillBriefIfEmpty(brief, "contact_last_name", contact.last_name);
    if (!contact.first_name && !contact.last_name) {
      const legacy = String(brief.contact_name ?? "").trim();
      if (legacy) {
        const [first, ...rest] = legacy.split(/\s+/);
        fillBriefIfEmpty(brief, "contact_first_name", first);
        fillBriefIfEmpty(brief, "contact_last_name", rest.join(" "));
      }
    }
    const fullName =
      `${contact.first_name ?? ""} ${contact.last_name ?? ""}`.trim();
    fillBriefIfEmpty(brief, "contact_name", fullName || undefined);
    fillBriefIfEmpty(brief, "contact_email", contact.email);
    fillBriefIfEmpty(brief, "contact_phone", contact.phone);
    fillBriefIfEmpty(brief, "form_notification_email", contact.email);
    fillBriefIfEmpty(brief, "whatsapp_business", contact.phone);
  }

  if (company) {
    fillBriefIfEmpty(brief, "company_name", company.name);
    fillBriefIfEmpty(brief, "existing_website", company.website);
    fillBriefIfEmpty(brief, "business_phone", company.phone_number);

    const fullAddress = formatBriefAddress([
      company.address,
      company.city,
      company.state_abbr,
      company.zipcode,
    ]);
    fillBriefIfEmpty(brief, "full_address", fullAddress);
    fillBriefIfEmpty(brief, "full_address_street", company.address ?? "");
    fillBriefIfEmpty(brief, "full_address_city", company.city ?? "");
    fillBriefIfEmpty(brief, "full_address_state", company.state_abbr ?? "");
    fillBriefIfEmpty(brief, "full_address_zip", company.zipcode ?? "");
  }

  if (isBriefValueEmpty(brief.full_address) && contact?.address?.trim()) {
    fillBriefIfEmpty(brief, "full_address", contact.address.trim());
  }

  return brief;
};
