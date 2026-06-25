import type { Identifier } from "ra-core";
import type { LeadType } from "@/modules/leads/leadFormConstants";
import { PRIMARY_MOVE_CONFIRMED_FIELD } from "@/modules/contacts/companyDraft";

/** UI person type — maps to `contacts.status` (`lead` or `contact_only` only). */
export type PersonKind = "prospect" | "contact_only";

export type PersonFormMode = "directory" | "pipeline" | "compact" | "deferred";

export type PersonCompanySectionVariant = "picker" | "inline_draft" | "hidden";

export type PersonFormValues = {
  first_name: string;
  last_name: string;
  title: string;
  email_jsonb: { email: string; type: string }[];
  phone_jsonb: { number: string; type: string }[];
  address: string;
  city: string;
  state_abbr: string;
  zipcode: string;
  country: string;
  company_id?: Identifier | null;
  [PRIMARY_MOVE_CONFIRMED_FIELD]?: boolean;
  company_draft_name: string;
  company_draft_website: string;
  company_draft_phone: string;
  company_draft_address: string;
  company_draft_sector: string;
  add_primary_contact: boolean;
  use_company_contact_info: boolean;
  /** UI selector; kept in sync with `status` for create flows. */
  person_kind: PersonKind;
  status: string;
  lead_type: LeadType;
  lead_source: string;
  lead_source_other?: string | null;
  referred_by_contact_id?: number | null;
  referred_by_company_id?: number | null;
  interested_services: string[];
  lead_stage: string | null;
  organization_member_id?: Identifier;
  assigned_member_ids: (number | string)[];
  background: string;
};

export type PersonFormFieldsProps = {
  mode?: PersonFormMode;
  /** When set, company picker is hidden (existing company or deferred create). */
  lockCompanyId?: Identifier;
  /** Compact create shows identity + contact + company until expanded. */
  variant?: "full" | "compact";
};

export type PersonFormVisibilityInput = {
  mode: PersonFormMode;
  personKind: PersonKind;
  leadType: LeadType;
  addPrimaryContact: boolean;
  lockCompanyId?: Identifier | null;
  expanded?: boolean;
};

export type PersonFormVisibility = {
  showIdentitySection: boolean;
  showContactSection: boolean;
  companySection: PersonCompanySectionVariant;
  showTypeSelector: boolean;
  showLeadProfileToggle: boolean;
  showSalesSection: boolean;
  showAssignmentSection: boolean;
  assignmentMulti: boolean;
  showMoreOptions: boolean;
  showContactFieldsInMainFlow: boolean;
  showUseCompanyContactInfo: boolean;
  showInactiveDirectoryStatus: boolean;
  showLeadStageBadge: boolean;
  compactCollapsed: boolean;
};
