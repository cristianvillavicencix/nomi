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

export const buildBriefPrefillFromCrm = ({
  deal,
  contact,
  company,
}: {
  deal?: {
    project_type?: string | null;
    website_brief?: Record<string, unknown> | null;
    name?: string | null;
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
    prefill.project_type = deal.project_type;
  }

  const contactName = contact
    ? `${contact.first_name ?? ""} ${contact.last_name ?? ""}`.trim()
    : "";
  const contactEmail = contact ? primaryEmail(contact.email_jsonb) : "";
  const contactPhone = contact ? primaryPhone(contact.phone_jsonb) : "";

  if (contactName) prefill.contact_name = contactName;
  if (contactEmail) {
    prefill.contact_email = contactEmail;
    prefill.form_notification_email ??= contactEmail;
  }
  if (contactPhone) {
    prefill.contact_phone = contactPhone;
    prefill.whatsapp_business ??= contactPhone;
  }

  if (company?.name) prefill.company_name = company.name;
  if (company?.website) prefill.existing_website = company.website;
  if (company?.phone_number) prefill.business_phone = company.phone_number;

  const companyAddress = formatAddress([
    company?.address,
    company?.city,
    company?.state_abbr,
    company?.zipcode,
  ]);
  const address = companyAddress || contact?.address?.trim() || "";
  if (address) prefill.full_address = address;

  return prefill;
};
