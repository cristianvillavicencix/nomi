type EmailJson = { email?: string | null; type?: string | null };
type PhoneJson = { number?: string | null; type?: string | null };

const primaryEmail = (entries?: EmailJson[] | null) =>
  entries?.find((entry) => entry.email?.trim())?.email?.trim() ?? "";

const primaryPhone = (entries?: PhoneJson[] | null) =>
  entries?.find((entry) => entry.number?.trim())?.number?.trim() ?? "";

const formatAddress = (parts: Array<string | null | undefined>) =>
  parts
    .map((part) => part?.trim())
    .filter(Boolean)
    .join(", ");

const isEmpty = (value: unknown) => {
  if (value == null) return true;
  if (typeof value === "string") return value.trim().length === 0;
  if (Array.isArray(value)) return value.length === 0;
  return false;
};

const fillIfEmpty = (
  prefill: Record<string, unknown>,
  key: string,
  value: string | undefined | null,
) => {
  if (value == null || value === "") return;
  if (!isEmpty(prefill[key])) return;
  prefill[key] = value;
};

export const buildBriefPrefillFromCrm = ({
  deal,
  contact,
  company,
}: {
  deal?: {
    project_type?: string | null;
    website_brief?: Record<string, unknown> | null;
  } | null;
  contact?: {
    first_name?: string | null;
    last_name?: string | null;
    email_jsonb?: EmailJson[] | null;
    phone_jsonb?: PhoneJson[] | null;
    address?: string | null;
  } | null;
  company?: {
    name?: string | null;
    website?: string | null;
    phone_number?: string | null;
    address?: string | null;
    city?: string | null;
    state_abbr?: string | null;
    zipcode?: string | null;
  } | null;
}) => {
  const prefill: Record<string, unknown> = {};

  if (deal?.website_brief && typeof deal.website_brief === "object") {
    Object.assign(prefill, deal.website_brief);
  }
  if (deal?.project_type) {
    fillIfEmpty(prefill, "project_type", deal.project_type);
  }

  const contactName = contact
    ? `${contact.first_name ?? ""} ${contact.last_name ?? ""}`.trim()
    : "";
  const contactEmail = contact ? primaryEmail(contact.email_jsonb) : "";
  const contactPhone = contact ? primaryPhone(contact.phone_jsonb) : "";

  if (contact) {
    fillIfEmpty(prefill, "contact_first_name", contact.first_name);
    fillIfEmpty(prefill, "contact_last_name", contact.last_name);
    if (!contact.first_name && !contact.last_name && contactName) {
      const [first, ...rest] = contactName.split(/\s+/);
      fillIfEmpty(prefill, "contact_first_name", first);
      fillIfEmpty(prefill, "contact_last_name", rest.join(" "));
    }
    fillIfEmpty(prefill, "contact_name", contactName || undefined);
    fillIfEmpty(prefill, "contact_email", contactEmail);
    fillIfEmpty(prefill, "form_notification_email", contactEmail);
    fillIfEmpty(prefill, "contact_phone", contactPhone);
    fillIfEmpty(prefill, "whatsapp_business", contactPhone);
  }

  if (company) {
    fillIfEmpty(prefill, "company_name", company.name);
    fillIfEmpty(prefill, "existing_website", company.website);
    fillIfEmpty(prefill, "business_phone", company.phone_number);

    const companyAddress = formatAddress([
      company.address,
      company.city,
      company.state_abbr,
      company.zipcode,
    ]);
    fillIfEmpty(prefill, "full_address", companyAddress);
    fillIfEmpty(prefill, "full_address_street", company.address ?? "");
    fillIfEmpty(prefill, "full_address_city", company.city ?? "");
    fillIfEmpty(prefill, "full_address_state", company.state_abbr ?? "");
    fillIfEmpty(prefill, "full_address_zip", company.zipcode ?? "");
  }

  if (isEmpty(prefill.full_address) && contact?.address?.trim()) {
    fillIfEmpty(prefill, "full_address", contact.address.trim());
  }

  return prefill;
};
