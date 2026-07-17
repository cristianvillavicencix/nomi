import type { Identifier } from "ra-core";
import { LBS_LEAD_SOURCE_OTHER } from "@/modules/leads/leadFormConstants";
import { applyLeadAssignmentFields } from "@/modules/leads/leadAssignments";

export type QuickMeetingContactFormValues = {
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
};

export const buildQuickMeetingContactPayload = (
  values: QuickMeetingContactFormValues,
  organizationMemberId?: Identifier | null,
  options?: { leadSourceOther?: string },
) => {
  const now = new Date().toISOString();
  const email = values.email.trim();
  const phone = values.phone.trim();

  return applyLeadAssignmentFields({
    first_name: values.first_name.trim(),
    last_name: values.last_name.trim(),
    email_jsonb: email ? [{ email, type: "Work" }] : [],
    phone_jsonb: phone ? [{ number: phone, type: "Work" }] : [],
    status: "lead",
    lead_stage: "new",
    lead_source: LBS_LEAD_SOURCE_OTHER,
    lead_source_other: options?.leadSourceOther?.trim() || "Quick call",
    company_id: null,
    title: "",
    background: "",
    interested_service: null,
    first_seen: now,
    last_seen: now,
    tags: [],
    organization_member_id: organizationMemberId ?? null,
    assigned_member_ids:
      organizationMemberId != null && organizationMemberId !== ""
        ? [organizationMemberId]
        : [],
  });
};

export const validateQuickMeetingContactForm = (
  values: QuickMeetingContactFormValues,
) => {
  if (!values.first_name?.trim()) {
    return "First name is required";
  }
  if (!values.email?.trim() && !values.phone?.trim()) {
    return "Add an email or phone number to share the call link";
  }
  return undefined;
};
