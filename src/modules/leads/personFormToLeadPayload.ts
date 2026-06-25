import type { PersonFormValues } from "@/modules/contacts/personFormTypes";
import type { NewLeadFormValues } from "./newLeadFormTypes";

/** Map unified person form values to the existing lead create payload shape. */
export const personFormValuesToNewLeadForm = (
  values: PersonFormValues,
): NewLeadFormValues => ({
  lead_type: values.lead_type,
  lead_source: values.lead_source,
  lead_source_other: values.lead_source_other,
  referred_by_contact_id: values.referred_by_contact_id,
  referred_by_company_id: values.referred_by_company_id,
  interested_services: values.interested_services ?? [],
  status: values.status,
  assigned_member_ids: values.assigned_member_ids ?? [],
  company_id: values.company_id ?? null,
  add_primary_contact: values.add_primary_contact,
  company_draft_name: values.company_draft_name,
  company_draft_website: values.company_draft_website,
  company_draft_phone: values.company_draft_phone,
  company_draft_address: values.company_draft_address,
  company_draft_sector: values.company_draft_sector,
  use_company_contact_info: values.use_company_contact_info,
  first_name: values.first_name,
  last_name: values.last_name,
  address: values.address,
  title: values.title,
  email_jsonb: values.email_jsonb,
  phone_jsonb: values.phone_jsonb,
  background: values.background,
  lead_value_estimate: values.lead_value_estimate ?? null,
  next_followup_at: values.next_followup_at ?? null,
});
