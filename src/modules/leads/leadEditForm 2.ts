import type { Contact } from "@/components/atomic-crm/types";
import { prepareContactWriteData } from "@/components/atomic-crm/providers/supabase/dataProviderWriteHelpers";
import {
  defaultPersonFormValues,
  statusToPersonKind,
} from "@/modules/contacts/personFormLogic";
import type { PersonFormValues } from "@/modules/contacts/personFormTypes";
import { applyLeadAssignmentFields } from "@/modules/leads/leadAssignments";
import {
  LBS_LEAD_SOURCE_OTHER,
  LBS_LEAD_SOURCE_REFERRAL,
} from "@/modules/leads/leadFormConstants";
import type { LeadType } from "@/modules/leads/leadFormConstants";
import { personFormValuesToNewLeadForm } from "@/modules/leads/personFormToLeadPayload";
import { normalizeUsPhoneToE164 } from "@/utils/phone";

const withSubmitNormalizedPhones = (data: Contact): Contact => ({
  ...data,
  phone_jsonb: data.phone_jsonb?.map((entry) => {
    const raw = String(entry.number ?? "").trim();
    if (!raw) return entry;
    const normalized = normalizeUsPhoneToE164(raw);
    return normalized ? { ...entry, number: normalized } : entry;
  }),
});

export const contactToLeadEditFormValues = (
  contact: Contact,
): PersonFormValues => {
  const personKind = statusToPersonKind(contact.status);
  const interestedServices =
    contact.interested_services ??
    (contact.interested_service?.trim()
      ? [contact.interested_service.trim()]
      : []);

  return {
    ...defaultPersonFormValues("pipeline"),
    ...contact,
    person_kind: personKind,
    lead_type: (contact.lead_type as LeadType | undefined) ?? "individual",
    lead_source: contact.lead_source ?? "",
    lead_source_other: contact.lead_source_other ?? null,
    referred_by_contact_id: contact.referred_by_contact_id ?? null,
    referred_by_company_id: contact.referred_by_company_id ?? null,
    interested_services: interestedServices,
    assigned_member_ids: applyLeadAssignmentFields({
      assigned_member_ids: contact.assigned_member_ids,
      organization_member_id: contact.organization_member_id,
    }).assigned_member_ids,
    email_jsonb: contact.email_jsonb?.length
      ? contact.email_jsonb
      : [{ email: "", type: "Work" }],
    phone_jsonb: contact.phone_jsonb?.length
      ? contact.phone_jsonb
      : [{ number: "", type: "Work" }],
    add_primary_contact: true,
    use_company_contact_info: false,
    lead_value_estimate: contact.lead_value_estimate ?? null,
    next_followup_at: contact.next_followup_at ?? null,
  };
};

export const leadEditTransform = (
  data: PersonFormValues & Contact,
): Partial<Contact> => {
  const normalized = withSubmitNormalizedPhones(data);
  const leadValues = personFormValuesToNewLeadForm(normalized);
  const assigned = applyLeadAssignmentFields({
    assigned_member_ids: leadValues.assigned_member_ids,
    organization_member_id: normalized.organization_member_id,
  });
  const isReferral = leadValues.lead_source === LBS_LEAD_SOURCE_REFERRAL;
  const isOther = leadValues.lead_source === LBS_LEAD_SOURCE_OTHER;
  const prepared = prepareContactWriteData({
    ...normalized,
    ...assigned,
    ...leadValues,
    interested_service:
      leadValues.interested_services.filter(Boolean).join(", ") ||
      normalized.interested_service ||
      null,
  } as Record<string, unknown>) as Partial<Contact>;

  // Belt-and-suspenders: never send form-only array to PostgREST
  delete (prepared as Record<string, unknown>).interested_services;
  delete (prepared as Record<string, unknown>).person_kind;
  delete (prepared as Record<string, unknown>).add_primary_contact;
  delete (prepared as Record<string, unknown>).use_company_contact_info;

  return {
    ...prepared,
    assigned_member_ids: assigned.assigned_member_ids,
    organization_member_id: assigned.organization_member_id,
    referred_by_contact_id: isReferral
      ? (leadValues.referred_by_contact_id ?? null)
      : null,
    referred_by_company_id: isReferral
      ? (leadValues.referred_by_company_id ?? null)
      : null,
    lead_source_other: isOther ? (leadValues.lead_source_other ?? null) : null,
  };
};
