import type { Company, Contact } from "@/components/atomic-crm/types";
import {
  companyDraftToCreateData,
  getCompanyDraftFromFormValues,
} from "@/modules/contacts/companyDraft";
import { applyLeadAssignmentFields } from "./leadAssignments";
import { isOtherSource, isReferralSource } from "./leadFormConstants";
import type { CreatedLeadPayload, NewLeadFormValues } from "./newLeadFormTypes";

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
): Partial<Company> => {
  const draft = getCompanyDraftFromFormValues(values);
  if (!draft?.name) {
    throw new Error("Company name is required");
  }
  return companyDraftToCreateData(draft, organizationMemberId);
};

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
    return applyLeadAssignmentFields({
      first_name: name,
      last_name: "Lead",
      company_id: companyId ?? null,
      email_jsonb: [],
      phone_jsonb: [],
      lead_source: values.lead_source,
      lead_source_other: isOther ? (values.lead_source_other ?? null) : null,
      referred_by_contact_id: isReferral
        ? (values.referred_by_contact_id ?? null)
        : null,
      referred_by_company_id: isReferral
        ? (values.referred_by_company_id ?? null)
        : null,
      interested_service,
      status: values.status ?? "lead",
      lead_stage: "new",
      assigned_member_ids: values.assigned_member_ids,
      background: values.background?.trim() || "",
      first_seen: now,
      last_seen: now,
      tags: [],
      title: "",
      lead_value_estimate: values.lead_value_estimate ?? null,
      next_followup_at: values.next_followup_at ?? null,
    });
  }

  return applyLeadAssignmentFields({
    first_name: values.first_name.trim(),
    last_name: values.last_name.trim(),
    address: values.address?.trim() || "",
    title: values.lead_type === "business" ? values.title?.trim() || "" : "",
    company_id:
      values.lead_type === "business"
        ? (companyId ?? null)
        : (companyId ?? values.company_id ?? null),
    email_jsonb: cleanEmailJsonb(values.email_jsonb),
    phone_jsonb: cleanPhoneJsonb(values.phone_jsonb),
    lead_source: values.lead_source,
    lead_source_other: isOther ? (values.lead_source_other ?? null) : null,
    referred_by_contact_id: isReferral
      ? (values.referred_by_contact_id ?? null)
      : null,
    referred_by_company_id: isReferral
      ? (values.referred_by_company_id ?? null)
      : null,
    interested_service,
    status: values.status ?? "lead",
    lead_stage: "new",
    assigned_member_ids: values.assigned_member_ids,
    background: values.background?.trim() || "",
    first_seen: now,
    last_seen: now,
    tags: [],
    lead_value_estimate: values.lead_value_estimate ?? null,
    next_followup_at: values.next_followup_at ?? null,
  });
};
