import type { Company, Contact } from "@/components/atomic-crm/types";
import type { NewLeadFormValues, CreatedLeadPayload } from "./newLeadFormTypes";
import { isOtherSource, isReferralSource } from "./leadFormConstants";

const normalizeWebsite = (raw: string) => {
  const trimmed = raw.trim();
  if (!trimmed) return "";
  return trimmed.startsWith("http") ? trimmed : `https://${trimmed}`;
};

const cleanEmailJsonb = (rows: NewLeadFormValues["email_jsonb"]) =>
  rows
    .filter((row) => row.email?.trim())
    .map((row) => ({ email: row.email.trim(), type: row.type || "Work" }));

const cleanPhoneJsonb = (rows: NewLeadFormValues["phone_jsonb"]) =>
  rows
    .filter((row) => row.number?.trim())
    .map((row) => ({ number: row.number.trim(), type: row.type || "Work" }));

export const buildCompanyCreateData = (
  values: NewLeadFormValues,
  organizationMemberId?: number | string,
): Partial<Company> => ({
  name: values.company_draft_name.trim(),
  website: normalizeWebsite(values.company_draft_website),
  phone_number: values.company_draft_phone.trim(),
  address: values.company_draft_address.trim(),
  sector: values.company_draft_sector || "other",
  organization_member_id: organizationMemberId,
  created_at: new Date().toISOString(),
});

export const buildContactCreatePayload = (
  values: NewLeadFormValues,
  companyId: number | string | null | undefined,
  companyNameForPlaceholder?: string,
): CreatedLeadPayload => {
  const now = new Date().toISOString();
  const isReferral = isReferralSource(values.lead_source);
  const isOther = isOtherSource(values.lead_source);
  const showContact =
    values.lead_type === "individual" ||
    (values.lead_type === "business" && values.add_primary_contact);

  const interested_service =
    values.interested_services?.filter(Boolean).join(", ") || null;

  if (!showContact) {
    const name = companyNameForPlaceholder?.trim() || "Company";
    return {
      first_name: name,
      last_name: "Lead",
      company_id: companyId ?? null,
      email_jsonb: [],
      phone_jsonb: [],
      lead_source: values.lead_source,
      lead_source_other: isOther ? values.lead_source_other ?? null : null,
      referred_by_contact_id: isReferral
        ? (values.referred_by_contact_id ?? null)
        : null,
      referred_by_company_id: isReferral
        ? (values.referred_by_company_id ?? null)
        : null,
      interested_service,
      status: values.status ?? "new",
      organization_member_id: values.organization_member_id,
      background: values.background?.trim() || "",
      first_seen: now,
      last_seen: now,
      tags: [],
      title: "",
    };
  }

  return {
    first_name: values.first_name.trim(),
    last_name: values.last_name.trim(),
    title: values.lead_type === "business" ? values.title?.trim() || "" : "",
    company_id: values.lead_type === "business" ? (companyId ?? null) : null,
    email_jsonb: cleanEmailJsonb(values.email_jsonb),
    phone_jsonb: cleanPhoneJsonb(values.phone_jsonb),
    lead_source: values.lead_source,
    lead_source_other: isOther ? values.lead_source_other ?? null : null,
    referred_by_contact_id: isReferral
      ? (values.referred_by_contact_id ?? null)
      : null,
    referred_by_company_id: isReferral
      ? (values.referred_by_company_id ?? null)
      : null,
    interested_service,
    status: values.status ?? "new",
    organization_member_id: values.organization_member_id,
    background: values.background?.trim() || "",
    first_seen: now,
    last_seen: now,
    tags: [],
  };
};
