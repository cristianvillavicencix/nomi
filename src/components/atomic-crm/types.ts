import type { Identifier, RaRecord } from "ra-core";
import type { ComponentType } from "react";

import type {
  COMPANY_CREATED,
  CONTACT_CREATED,
  CONTACT_NOTE_CREATED,
  DEAL_CREATED,
  DEAL_NOTE_CREATED,
} from "./consts";

export type SignUpData = {
  email: string;
  password: string;
  first_name: string;
  last_name: string;
  /** Company / organization name; used on sign-up to create an isolated org (see handle_new_user). */
  company_name: string;
};

export const MEMBER_MODULE_KEYS = [
  "crm",
  "proposals",
  "forms",
  "support",
  "messaging",
  "deal_operations",
  "deal_financials",
  "reports",
  "view_amounts",
] as const;

export type MemberModuleKey = (typeof MEMBER_MODULE_KEYS)[number];

/** Stored in organization_members.module_permissions (JSON); drives UI + synced roles[]. */
export type MemberModulePermissions = Partial<
  Record<MemberModuleKey, boolean>
> &
  Record<string, boolean | string | undefined>;

export type OrganizationMemberFormData = {
  avatar?: RAFile | null;
  email: string;
  password?: string;
  first_name: string;
  last_name: string;
  administrator: boolean;
  /** Legacy; synced from modules when module_permissions is set. */
  roles?: string[];
  module_permissions?: MemberModulePermissions | null;
  disabled: boolean;
};

/** Workspaces / tenants (`public.organizations`). Exposed to the Platform console for billing. */
export type OrganizationForPlatform = {
  name: string;
  email?: string | null;
  phone?: string | null;
  website?: string | null;
  address?: string | null;
  created_at?: string | null;
  disabled_at?: string | null;
  stripe_customer_id?: string | null;
  stripe_subscription_id?: string | null;
  stripe_seat_price_id?: string | null;
  billing_status?: string | null;
  billable_seat_count?: number | null;
  price_per_seat_usd_monthly?: number | null;
} & Pick<RaRecord, "id">;

/**
 * `public.organization_members` — CRM login + profile (one row per auth user, scoped by `org_id`).
 * Formerly named "sales" in the Atomic schema.
 */
export type OrganizationMember = {
  first_name: string;
  last_name: string;
  /** Tenant scope; all CRM rows are filtered by this via RLS. */
  org_id?: number;
  administrator: boolean;
  roles?: string[];
  /** Non-null ⇒ use module switches; backend mirrors roles[] for RLS. */
  module_permissions?: MemberModulePermissions | null;
  avatar?: RAFile;
  avatar_type?: "peep" | "upload" | "default" | null;
  avatar_url?: string | null;
  disabled?: boolean;
  user_id: string;

  /**
   * This is a copy of the user's email, to make it easier to handle by react admin
   * DO NOT UPDATE this field directly, it should be updated by the backend
   */
  email: string;

  /** E.164 SMS destination for forms and alerts; separate from auth.users.phone */
  notification_phone?: string | null;

  /**
   * This is used by the fake rest provider to store the password
   * DO NOT USE this field in your code besides the fake rest provider
   * @deprecated
   */
  password?: string;
} & Pick<RaRecord, "id">;

export type Company = {
  name: string;
  logo: RAFile;
  sector: string;
  size: 1 | 10 | 50 | 250 | 500;
  linkedin_url: string;
  website: string;
  phone_number: string;
  address: string;
  zipcode: string;
  city: string;
  state_abbr: string;
  organization_member_id?: Identifier | null;
  created_at: string;
  description: string;
  revenue: string;
  tax_identifier: string;
  country: string;
  context_links?: string[];
  nb_contacts?: number;
  nb_deals?: number;
  primary_contact_id?: Identifier | null;
  primary_contact_first_name?: string | null;
  primary_contact_last_name?: string | null;
  primary_contact_status?: string | null;
  primary_contact_email_jsonb?: EmailAndType[] | null;
  primary_contact_phone_jsonb?: PhoneNumberAndType[] | null;
  primary_contact_lead_source?: string | null;
  primary_contact_interested_service?: string | null;
} & Pick<RaRecord, "id">;

export type EmailAndType = {
  email: string;
  type: "Work" | "Home" | "Other";
};

export type PhoneNumberAndType = {
  number: string;
  type: "Work" | "Home" | "Other";
};

export type Contact = {
  first_name: string;
  last_name: string;
  title?: string | null;
  address?: string | null;
  company_id?: Identifier | null;
  email_jsonb: EmailAndType[];
  avatar?: Partial<RAFile>;
  linkedin_url?: string | null;
  first_seen: string;
  last_seen: string;
  has_newsletter: boolean;
  tags: Identifier[];
  gender: string;
  organization_member_id?: Identifier | null;
  assigned_member_ids?: Identifier[];
  status: string;
  background: string;
  phone_jsonb: PhoneNumberAndType[];
  lead_source?: string | null;
  lead_source_other?: string | null;
  lead_stage?: string | null;
  snooze_until?: string | null;
  next_followup_at?: string | null;
  last_contacted_at?: string | null;
  lead_value_estimate?: number | null;
  interested_service?: string | null;
  referred_by_contact_id?: Identifier | null;
  referred_by_company_id?: Identifier | null;
  nb_tasks?: number;
  company_name?: string;
  is_primary_contact?: boolean;
} & Pick<RaRecord, "id">;

export type ContactNote = {
  contact_id: Identifier;
  text: string;
  date: string;
  organization_member_id: Identifier;
  status: string;
  attachments?: AttachmentNote[];
} & Pick<RaRecord, "id">;

export type Deal = {
  name: string;
  company_id: Identifier;
  company_name?: string | null;
  contact_id?: Identifier | null;
  contact_ids: Identifier[];
  pipeline_id?: string;
  category: string;
  project_type?: string | null;
  stage: string;
  description: string;
  notes?: string | null;
  amount: number;
  estimated_value?: number | null;
  original_project_value?: number | null;
  current_project_value?: number | null;
  value_includes_material?: boolean;
  project_address?: string | null;
  project_place_id?: string | null;
  project_address_meta?: Record<string, unknown> | null;
  website_brief?: Record<string, string | null | undefined>;
  website_content?: Record<string, unknown>;
  /** LBS agency: opportunity | delivery | closed */
  lifecycle_phase?: "opportunity" | "delivery" | "closed";
  /** LBS agency: operational sub-status (design, dev, review, launch, …) */
  delivery_status?: string | null;
  accepted_proposal_id?: Identifier | null;
  priority?: "low" | "normal" | "high" | "urgent";
  salesperson_ids?: Identifier[];
  subcontractor_ids?: Identifier[];
  worker_ids?: Identifier[];
  start_date?: string | null;
  expected_end_date?: string | null;
  actual_completion_date?: string | null;
  estimated_completion_time?: string | null;
  github_repo?: string | null;
  created_at: string;
  updated_at: string;
  archived_at?: string;
  expected_closing_date: string;
  organization_member_id: Identifier;
  index: number;
} & Pick<RaRecord, "id">;

export type DealNote = {
  deal_id: Identifier;
  text: string;
  date: string;
  organization_member_id: Identifier;
  attachments?: AttachmentNote[];

  // This is defined for compatibility with `ContactNote`
  status?: undefined;
} & Pick<RaRecord, "id">;

export type Tag = {
  id: number;
  name: string;
  color: string;
};

export type Task = {
  contact_id?: Identifier | null;
  deal_id?: Identifier | null;
  type: string;
  text: string;
  due_date: string;
  done_date?: string | null;
  created_at?: string;
  organization_member_id?: Identifier;
  assignee_person_ids?: Identifier[];
  collaborator_person_ids?: Identifier[];
  mentioned_member_ids?: Identifier[];
  priority?: string;
  internal?: boolean;
} & Pick<RaRecord, "id">;

export type TaskAssignee = {
  task_id: Identifier;
  person_id: Identifier;
  role: "assignee" | "collaborator" | "watcher";
  created_at?: string;
} & Pick<RaRecord, "id">;

export type TaskParticipant = {
  task_id: Identifier;
  person_id?: Identifier | null;
  organization_member_id?: Identifier | null;
  completed_at?: string | null;
  created_at?: string;
} & Pick<RaRecord, "id">;

export type TaskTagNotification = {
  task_id: Identifier;
  person_id?: Identifier | null;
  recipient_organization_member_id: Identifier;
  read_at?: string | null;
  created_at?: string;
} & Pick<RaRecord, "id">;

export type CalendarEventRecord = {
  title: string;
  event_date: string;
  event_time?: string | null;
  duration_minutes?: number | null;
  remind_before_minutes?: number | null;
  description?: string | null;
  meeting_url?: string | null;
  deal_id?: Identifier | null;
  contact_id?: Identifier | null;
  company_id?: Identifier | null;
  organization_member_id?: Identifier | null;
  completed_at?: string | null;
  created_at?: string;
  updated_at?: string;
} & Pick<RaRecord, "id">;

export type DealExpense = {
  deal_id: Identifier;
  expense_type: string;
  vendor?: string | null;
  description?: string | null;
  amount: number;
  purchase_date?: string | null;
  paid: boolean;
  attachments?: RAFile[];
  notes?: string | null;
  created_by_member_id?: Identifier | null;
  created_at?: string;
  updated_at?: string;
} & Pick<RaRecord, "id">;

export type DealChangeOrder = {
  deal_id: Identifier;
  title: string;
  description?: string | null;
  change_date: string;
  amount: number;
  reason?: string | null;
  status: "draft" | "sent" | "approved" | "rejected";
  attachments?: RAFile[];
  created_by_member_id?: Identifier | null;
  created_at?: string;
  updated_at?: string;
} & Pick<RaRecord, "id">;

export type DealClientPayment = {
  deal_id: Identifier;
  payment_date: string;
  amount: number;
  payment_method: "check" | "cash" | "zelle" | "ach" | "card" | "other";
  check_number?: string | null;
  reference_number?: string | null;
  status: "pending" | "cleared" | "bounced" | "deposited";
  attachments?: RAFile[];
  notes?: string | null;
  created_by_member_id?: Identifier | null;
  created_at?: string;
  updated_at?: string;
} & Pick<RaRecord, "id">;

export type ActivityCompanyCreated = {
  type: typeof COMPANY_CREATED;
  company_id: Identifier;
  company: Company;
  organization_member_id: Identifier;
  date: string;
} & Pick<RaRecord, "id">;

export type ActivityContactCreated = {
  type: typeof CONTACT_CREATED;
  company_id: Identifier;
  organization_member_id?: Identifier;
  contact: Contact;
  date: string;
} & Pick<RaRecord, "id">;

export type ActivityContactNoteCreated = {
  type: typeof CONTACT_NOTE_CREATED;
  organization_member_id?: Identifier;
  contactNote: ContactNote;
  date: string;
} & Pick<RaRecord, "id">;

export type ActivityDealCreated = {
  type: typeof DEAL_CREATED;
  company_id: Identifier;
  organization_member_id?: Identifier;
  deal: Deal;
  date: string;
};

export type ActivityDealNoteCreated = {
  type: typeof DEAL_NOTE_CREATED;
  organization_member_id?: Identifier;
  dealNote: DealNote;
  date: string;
};

export type Activity = RaRecord &
  (
    | ActivityCompanyCreated
    | ActivityContactCreated
    | ActivityContactNoteCreated
    | ActivityDealCreated
    | ActivityDealNoteCreated
  );

export interface RAFile {
  src: string;
  title: string;
  path?: string;
  rawFile: File;
  type?: string;
}

export type AttachmentNote = RAFile;

export interface LabeledValue {
  value: string;
  label: string;
}

export type DealStage = LabeledValue;

export type DealPipelineStage = {
  id: string;
  label: string;
  color: string;
  order: number;
  pipelineId: string;
  isDefault?: boolean;
};

export type DealPipeline = {
  id: string;
  label: string;
  order: number;
  isDefault?: boolean;
  stages: DealPipelineStage[];
};

export type OrganizationPipelineStage = {
  id: Identifier;
  org_id: Identifier;
  pipeline_id: string;
  key: string;
  label: string;
  color: string;
  order_index: number;
  is_won: boolean;
  is_lost: boolean;
  created_at?: string;
};

export interface NoteStatus extends LabeledValue {
  color: string;
}

export interface ContactGender {
  value: string;
  label: string;
  icon: ComponentType<{ className?: string }>;
}
