import type { Contact } from "@/components/atomic-crm/types";
import type { LeadType } from "./leadFormConstants";

export type NewLeadFormValues = {
  lead_type: LeadType;
  lead_source: string;
  lead_source_other?: string | null;
  referred_by_contact_id?: number | null;
  referred_by_company_id?: number | null;
  interested_services: string[];
  status: string;
  organization_member_id: number | string;
  add_primary_contact: boolean;
  company_draft_name: string;
  company_draft_website: string;
  company_draft_phone: string;
  company_draft_address: string;
  company_draft_sector: string;
  use_company_contact_info: boolean;
  first_name: string;
  last_name: string;
  title: string;
  email_jsonb: { email: string; type: string }[];
  phone_jsonb: { number: string; type: string }[];
  background: string;
};

export const defaultNewLeadFormValues = (
  organizationMemberId?: number | string,
): NewLeadFormValues => ({
  lead_type: "individual",
  lead_source: "",
  lead_source_other: null,
  referred_by_contact_id: null,
  referred_by_company_id: null,
  interested_services: [],
  status: "new",
  organization_member_id: organizationMemberId ?? "",
  add_primary_contact: true,
  company_draft_name: "",
  company_draft_website: "",
  company_draft_phone: "",
  company_draft_address: "",
  company_draft_sector: "",
  use_company_contact_info: false,
  first_name: "",
  last_name: "",
  title: "",
  email_jsonb: [{ email: "", type: "Work" }],
  phone_jsonb: [{ number: "", type: "Work" }],
  background: "",
});

export type CreatedLeadPayload = Partial<Contact> & {
  interested_service?: string | null;
};
