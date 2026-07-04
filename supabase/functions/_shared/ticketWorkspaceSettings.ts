export type TicketNotificationAudience = "assignee" | "team";

export type TicketWorkspaceSettings = {
  default_assignee_member_id: number | null;
  default_priority: string;
  default_status: string;
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
    mon: { enabled: true, start: "09:00", end: "17:00" },
    tue: { enabled: true, start: "09:00", end: "17:00" },
    wed: { enabled: true, start: "09:00", end: "17:00" },
    thu: { enabled: true, start: "09:00", end: "17:00" },
    fri: { enabled: true, start: "09:00", end: "17:00" },
    sat: { enabled: false, start: "09:00", end: "12:00" },
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

export const loadOrgTicketWorkspaceSettings = async (orgId: number) => {
  const { supabaseAdmin } = await import("./supabaseAdmin.ts");
  const { data, error } = await supabaseAdmin
    .from("organizations")
    .select("ticket_settings")
    .eq("id", orgId)
    .maybeSingle();

  if (error?.message?.includes("ticket_settings")) {
    return { ...DEFAULT_TICKET_WORKSPACE_SETTINGS };
  }
  if (error) throw new Error(error.message);
  return mergeTicketWorkspaceSettings(data?.ticket_settings ?? {});
};

export const saveOrgTicketWorkspaceSettings = async (
  orgId: number,
  patch: Partial<TicketWorkspaceSettings>,
) => {
  const current = await loadOrgTicketWorkspaceSettings(orgId);
  const next = { ...current, ...patch };
  const { supabaseAdmin } = await import("./supabaseAdmin.ts");
  const { error } = await supabaseAdmin
    .from("organizations")
    .update({ ticket_settings: next })
    .eq("id", orgId);
  if (error) throw new Error(error.message);
  return next;
};

const AUTO_RESPONDER_PATTERNS = [
  /mailer-daemon@/i,
  /postmaster@/i,
  /noreply@/i,
  /no-reply@/i,
  /auto-?reply@/i,
];

export const shouldIgnoreInboundSender = (
  email: string,
  settings: TicketWorkspaceSettings,
) => {
  if (!settings.ignore_auto_responders) return false;
  return AUTO_RESPONDER_PATTERNS.some((pattern) => pattern.test(email));
};

export const passesInboundDomainRules = (
  email: string,
  settings: TicketWorkspaceSettings,
) => {
  const domain = email.split("@")[1]?.toLowerCase() ?? "";
  if (!domain) return false;
  const blocked = settings.blocked_inbound_domains.map((d) =>
    d.trim().toLowerCase(),
  ).filter(Boolean);
  if (blocked.some((d) => domain === d || domain.endsWith(`.${d}`))) {
    return false;
  }
  const allowed = settings.allowed_inbound_domains.map((d) =>
    d.trim().toLowerCase(),
  ).filter(Boolean);
  if (allowed.length === 0) return true;
  return allowed.some((d) => domain === d || domain.endsWith(`.${d}`));
};

export const resolveRoundRobinAssignee = (
  settings: TicketWorkspaceSettings,
): number | null => {
  const ids = settings.round_robin_member_ids.filter((id) => Number(id) > 0);
  if (!settings.round_robin_enabled || ids.length === 0) return null;
  const index = Math.abs(settings.round_robin_index) % ids.length;
  return ids[index] ?? null;
};

export const nextRoundRobinIndex = (
  settings: TicketWorkspaceSettings,
): number => {
  const ids = settings.round_robin_member_ids.filter((id) => Number(id) > 0);
  if (ids.length === 0) return 0;
  return (Math.abs(settings.round_robin_index) + 1) % ids.length;
};

export const matchRoutingRule = (
  subject: string,
  settings: TicketWorkspaceSettings,
) => {
  const normalized = subject.toLowerCase();
  for (const rule of settings.routing_rules) {
    const needle = rule.match_subject_contains?.trim().toLowerCase();
    if (!needle || !normalized.includes(needle)) continue;
    return rule;
  }
  return null;
};

export const expandTicketSettingVariables = (
  template: string,
  vars: Record<string, string>,
) =>
  Object.entries(vars).reduce(
    (acc, [key, value]) =>
      acc.replaceAll(`{{${key}}}`, value).replaceAll(`{{ ${key} }}`, value),
    template,
  );
