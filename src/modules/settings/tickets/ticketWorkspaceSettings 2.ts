export type TicketNotificationAudience = "assignee" | "team";

export type TicketWorkspaceSettings = {
  default_assignee_member_id: number | null;
  default_priority: "low" | "normal" | "high" | "urgent";
  default_status: "new" | "open";
  auto_link_contact: boolean;
  notification_audience: TicketNotificationAudience;
  workspace_notify_sound: boolean;
  workspace_notify_desktop: boolean;
  require_status_change_note: boolean;
  auto_close_resolved_days: number | null;
  allowed_ticket_tags: string[];
  custom_statuses: Array<{ value: string; label: string; active: boolean }>;
  default_billing_kind: string | null;
  default_transfer_fee: number | null;
  invoice_reminder_days: number | null;
  allowed_inbound_domains: string[];
  blocked_inbound_domains: string[];
  ignore_auto_responders: boolean;
  max_reply_attachment_bytes: number;
  business_hours_enabled: boolean;
  business_hours_timezone: string;
  business_hours: Record<
    string,
    { enabled: boolean; start: string; end: string }
  >;
  sla_first_response_hours: number | null;
  round_robin_enabled: boolean;
  round_robin_member_ids: number[];
  round_robin_index: number;
  csat_enabled: boolean;
  csat_subject: string;
  csat_body_html: string;
  routing_rules: Array<{
    id: string;
    match_subject_contains: string;
    assignee_member_id: number | null;
    priority: string | null;
    tag: string | null;
  }>;
  macros: Array<{
    id: string;
    label: string;
    status: string | null;
    reply_template_id: string | null;
    internal_note: string | null;
  }>;
};

export type TicketCreateTemplate = {
  id: string;
  label: string;
  description?: string;
  body: string;
};

export type TicketInboxSettingsRow = {
  id: number;
  email: string;
  display_name: string | null;
  from_name: string | null;
  is_active: boolean;
  is_default: boolean;
  auto_reply_enabled: boolean;
  auto_reply_subject: string | null;
  auto_reply_html: string | null;
  auto_reply_text: string | null;
  create_templates: TicketCreateTemplate[];
  disabled_builtin_reply_template_ids: string[];
  reply_signature_html: string | null;
  reply_signature_text: string | null;
  reply_templates: TicketCreateTemplate[];
  sendgrid_hostname: string | null;
  sendgrid_forward_address: string | null;
  last_inbound_at: string | null;
};

export type TicketSettingsHealth = {
  webhook_configured: boolean;
  outbound_configured: boolean;
  last_inbound_at: string | null;
  last_inbound_inbox_email: string | null;
};

export type TicketWorkspaceSettingsResponse = {
  workspace: TicketWorkspaceSettings;
  inboxes: TicketInboxSettingsRow[];
  health: TicketSettingsHealth;
};

export const DEFAULT_TICKET_WORKSPACE_SETTINGS: TicketWorkspaceSettings = {
  default_assignee_member_id: null,
  default_priority: "normal",
  default_status: "new",
  auto_link_contact: true,
  notification_audience: "assignee",
  workspace_notify_sound: true,
  workspace_notify_desktop: true,
  require_status_change_note: true,
  auto_close_resolved_days: null,
  allowed_ticket_tags: [],
  custom_statuses: [],
  default_billing_kind: null,
  default_transfer_fee: null,
  invoice_reminder_days: null,
  allowed_inbound_domains: [],
  blocked_inbound_domains: [],
  ignore_auto_responders: true,
  max_reply_attachment_bytes: 5 * 1024 * 1024,
  business_hours_enabled: false,
  business_hours_timezone: "America/New_York",
  business_hours: {
    mon: { enabled: true, start: "08:00", end: "16:30" },
    tue: { enabled: true, start: "08:00", end: "16:30" },
    wed: { enabled: true, start: "08:00", end: "16:30" },
    thu: { enabled: true, start: "08:00", end: "16:30" },
    fri: { enabled: true, start: "08:00", end: "16:30" },
    sat: { enabled: true, start: "09:00", end: "14:00" },
    sun: { enabled: false, start: "09:00", end: "12:00" },
  },
  sla_first_response_hours: null,
  round_robin_enabled: false,
  round_robin_member_ids: [],
  round_robin_index: 0,
  csat_enabled: false,
  csat_subject: "How did we do?",
  csat_body_html:
    "<p>Your ticket was marked resolved. We'd love your feedback — reply to this email with a rating from 1–5.</p>",
  routing_rules: [],
  macros: [],
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

export const mergeTicketWorkspaceSettings = (
  raw: unknown,
): TicketWorkspaceSettings => {
  if (!isRecord(raw)) return { ...DEFAULT_TICKET_WORKSPACE_SETTINGS };
  const base = { ...DEFAULT_TICKET_WORKSPACE_SETTINGS };
  for (const key of Object.keys(base) as Array<keyof TicketWorkspaceSettings>) {
    if (raw[key] !== undefined) {
      (base as Record<string, unknown>)[key] = raw[key];
    }
  }
  return base;
};

export const DEFAULT_AUTO_REPLY_SUBJECT = "We received your request";

export const DEFAULT_AUTO_REPLY_TEXT = [
  "Thank you for contacting us.",
  "",
  "We received your request and assigned it ticket #{{ticketId}}.",
  "Our team will review it and follow up soon.",
  "",
  "If you meant to reply to an existing ticket, please use Reply on that email thread.",
  "",
  "{{orgName}}",
].join("\n");

export const expandTicketSettingVariables = (
  template: string,
  vars: Record<string, string>,
) =>
  Object.entries(vars).reduce(
    (acc, [key, value]) =>
      acc.replaceAll(`{{${key}}}`, value).replaceAll(`{{ ${key} }}`, value),
    template,
  );

export const passesInboundDomainRules = (
  email: string,
  settings: TicketWorkspaceSettings,
) => {
  const domain = email.split("@")[1]?.toLowerCase() ?? "";
  if (!domain) return false;
  const blocked = settings.blocked_inbound_domains
    .map((d) => d.trim().toLowerCase())
    .filter(Boolean);
  if (blocked.some((d) => domain === d || domain.endsWith(`.${d}`))) {
    return false;
  }
  const allowed = settings.allowed_inbound_domains
    .map((d) => d.trim().toLowerCase())
    .filter(Boolean);
  if (allowed.length === 0) return true;
  return allowed.some((d) => domain === d || domain.endsWith(`.${d}`));
};
