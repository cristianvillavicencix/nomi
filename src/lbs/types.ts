import type { Identifier, RaRecord } from "ra-core";

import type { Deal } from "@/components/atomic-crm/types";

export type {
  Company,
  Contact,
  Deal,
  OrganizationMember,
  Task,
} from "@/components/atomic-crm/types";

export type LbsDeal = Deal & {
  website_brief?: Record<string, string | null | undefined>;
  website_content?: Record<string, unknown>;
  lifecycle_phase?: "opportunity" | "delivery" | "closed";
  delivery_status?: string | null;
  accepted_proposal_id?: Identifier | null;
  priority?: "low" | "normal" | "high" | "urgent";
};

export type Proposal = {
  org_id?: number;
  company_id?: Identifier | null;
  contact_id?: Identifier | null;
  deal_id?: Identifier | null;
  organization_member_id?: Identifier | null;
  title: string;
  status: string;
  amount?: number | null;
  valid_until?: string | null;
  sent_at?: string | null;
  viewed_at?: string | null;
  accepted_at?: string | null;
  rejected_at?: string | null;
  content?: Record<string, unknown>;
  notes?: string | null;
  created_at?: string;
  updated_at?: string;
} & Pick<RaRecord, "id">;

export type ProposalLineItem = {
  proposal_id: Identifier;
  description: string;
  quantity?: number;
  unit_price?: number;
  sort_order?: number;
} & Pick<RaRecord, "id">;

export type Contract = {
  org_id?: number;
  company_id?: Identifier | null;
  contact_id?: Identifier | null;
  proposal_id?: Identifier | null;
  deal_id?: Identifier | null;
  organization_member_id?: Identifier | null;
  title: string;
  status: string;
  signed_at?: string | null;
  expires_at?: string | null;
  document?: Record<string, unknown>;
  file?: unknown;
  notes?: string | null;
  created_at?: string;
  updated_at?: string;
} & Pick<RaRecord, "id">;

export type Form = {
  org_id?: number;
  name: string;
  slug: string;
  description?: string | null;
  schema?: Record<string, unknown>;
  active?: boolean;
  created_at?: string;
  updated_at?: string;
} & Pick<RaRecord, "id">;

export type FormSubmission = {
  org_id?: number;
  form_id: Identifier;
  company_id?: Identifier | null;
  contact_id?: Identifier | null;
  deal_id?: Identifier | null;
  data?: Record<string, unknown>;
  created_at?: string;
} & Pick<RaRecord, "id">;

export type Ticket = {
  org_id?: number;
  company_id?: Identifier | null;
  contact_id?: Identifier | null;
  deal_id?: Identifier | null;
  assignee_id?: Identifier | null;
  organization_member_id?: Identifier | null;
  subject: string;
  status: string;
  priority: string;
  created_at?: string;
  updated_at?: string;
} & Pick<RaRecord, "id">;

export type TicketMessage = {
  ticket_id: Identifier;
  author_member_id?: Identifier | null;
  body: string;
  attachments?: unknown[];
  created_at?: string;
} & Pick<RaRecord, "id">;

export type DealResource = {
  org_id?: number;
  deal_id: Identifier;
  category: string;
  label?: string | null;
  file: {
    title: string;
    type: string;
    path: string;
    src: string;
    bucket?: string;
  };
  source?: "team" | "client" | string;
  visibility?: "internal" | "client" | "public" | string;
  mime_kind?: string | null;
  organization_member_id?: Identifier | null;
  created_at?: string;
} & Pick<RaRecord, "id">;

export type DealAccessEntry = {
  org_id?: number;
  deal_id: Identifier;
  label: string;
  url?: string | null;
  username?: string | null;
  password?: string | null;
  notes?: string | null;
  organization_member_id?: Identifier | null;
  created_at?: string;
  updated_at?: string;
} & Pick<RaRecord, "id">;

export type ConversationType = "team_dm" | "project" | "client";

export type MessageChannel = "internal" | "sms" | "whatsapp";

export type MessageDirection = "outbound" | "inbound";

export type Conversation = {
  org_id?: number;
  type: ConversationType;
  title?: string | null;
  deal_id?: Identifier | null;
  contact_id?: Identifier | null;
  external_phone?: string | null;
  dm_key?: string | null;
  last_message_at?: string | null;
  last_message_preview?: string | null;
  assignee_member_id?: Identifier | null;
  status?: "open" | "pending" | "closed" | "urgent";
  tags?: string[];
  priority?: "low" | "normal" | "high" | "urgent";
  first_response_at?: string | null;
  closed_at?: string | null;
  closed_by_member_id?: Identifier | null;
  created_by_member_id?: Identifier | null;
  created_at?: string;
  updated_at?: string;
} & Pick<RaRecord, "id">;

export type ConversationParticipant = {
  conversation_id: Identifier;
  member_id: Identifier;
  last_read_at?: string | null;
  created_at?: string;
} & Pick<RaRecord, "id">;

export type ConversationMessage = {
  conversation_id: Identifier;
  author_member_id?: Identifier | null;
  body: string;
  channel?: MessageChannel;
  direction?: MessageDirection;
  external_id?: string | null;
  media_url?: string | null;
  is_internal_note?: boolean;
  reply_to_message_id?: Identifier | null;
  edited_at?: string | null;
  deleted_at?: string | null;
  created_at?: string;
} & Pick<RaRecord, "id">;

export type MessageTemplate = {
  org_id: number;
  name: string;
  category?: string | null;
  language: "en" | "es";
  body: string;
  variables?: string[];
  channels?: string[];
  created_by_member_id?: Identifier | null;
  is_archived?: boolean;
  use_count?: number;
  created_at?: string;
  updated_at?: string;
} & Pick<RaRecord, "id">;

export type VoiceCall = {
  org_id: number;
  external_id?: string | null;
  direction: "inbound" | "outbound";
  status: string;
  from_number?: string | null;
  to_number?: string | null;
  contact_id?: Identifier | null;
  deal_id?: Identifier | null;
  member_id?: Identifier | null;
  conversation_id?: Identifier | null;
  duration_seconds?: number | null;
  recording_url?: string | null;
  recording_enabled?: boolean;
  started_at?: string | null;
  ended_at?: string | null;
  created_at?: string;
} & Pick<RaRecord, "id">;

export type ClientSmsDraft = {
  contact: Contact;
  dealId?: Identifier | null;
};

export type BusinessHoursDay = {
  open?: string | null;
  close?: string | null;
  closed?: boolean;
};

export type BusinessHoursConfig = Record<string, BusinessHoursDay>;

export type MessagingSettingsPublic = {
  org_id: number;
  twilio_account_sid: string | null;
  twilio_phone_number: string | null;
  sms_enabled: boolean;
  has_auth_token: boolean;
  webhook_url: string | null;
  business_hours?: BusinessHoursConfig | null;
  out_of_hours_message?: string | null;
  auto_acknowledge_enabled?: boolean;
  auto_acknowledge_message?: string | null;
};
