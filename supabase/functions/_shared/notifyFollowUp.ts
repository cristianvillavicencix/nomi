import type { SupabaseClient } from "jsr:@supabase/supabase-js@2";
import { getMessagingSettingsSecrets } from "./messagingSettings.ts";
import { normalizeUsPhoneToE164 } from "./phone.ts";
import { sendTwilioSms } from "./twilio.ts";

export type FollowUpNotificationKind = "scheduled" | "reminder";

type CalendarEventRow = {
  id: number;
  org_id: number;
  title: string;
  event_date: string;
  event_time?: string | null;
  description?: string | null;
  remind_before_minutes?: number | null;
  contact_id?: number | null;
  organization_member_id?: number | null;
  completed_at?: string | null;
  follow_up_scheduled_notified_at?: string | null;
  follow_up_reminder_sent_at?: string | null;
};

type ContactRow = {
  id: number;
  first_name?: string | null;
  last_name?: string | null;
  company_name?: string | null;
  status?: string | null;
  lead_stage?: string | null;
  phone_jsonb?: Array<{ number?: string | null; type?: string | null }> | null;
};

const LEAD_STATUSES = new Set(["lead", "warm", "cold", "prospect"]);

const toE164 = (phone: string): string | null => {
  const trimmed = phone.trim();
  if (!trimmed) return null;
  if (trimmed.startsWith("+") && /^\+[1-9]\d{1,14}$/.test(trimmed)) {
    return trimmed;
  }
  return normalizeUsPhoneToE164(trimmed);
};

const resolveMemberPhone = async (
  supabase: SupabaseClient,
  memberId: number,
): Promise<string | null> => {
  const { data: member } = await supabase
    .from("organization_members")
    .select("notification_phone, user_id")
    .eq("id", memberId)
    .maybeSingle();

  if (member?.notification_phone) {
    return toE164(member.notification_phone);
  }

  if (!member?.user_id) return null;

  const { data: authData, error } = await supabase.auth.admin.getUserById(
    member.user_id,
  );
  if (error || !authData?.user) return null;

  const authPhone = authData.user.phone?.trim();
  if (authPhone) {
    return toE164(authPhone);
  }

  const metaPhone =
    typeof authData.user.user_metadata?.phone === "string"
      ? authData.user.user_metadata.phone.trim()
      : "";
  if (metaPhone) {
    return toE164(metaPhone);
  }

  return null;
};

const resolveAppBaseUrl = (fallback?: string | null) => {
  const envUrl =
    Deno.env.get("PUBLIC_APP_URL")?.trim() ||
    Deno.env.get("VITE_PUBLIC_APP_URL")?.trim() ||
    Deno.env.get("BILLING_PUBLIC_SITE_URL")?.trim();
  if (envUrl) return envUrl.replace(/\/$/, "");
  if (fallback?.trim()) return fallback.replace(/\/$/, "");
  return "";
};

const normalizeEventTime = (value?: string | null) => {
  if (!value?.trim()) return "09:00";
  return value.trim().slice(0, 5);
};

export const parseCalendarEventDateTime = (
  eventDate: string,
  eventTime?: string | null,
) => {
  const dateKey = String(eventDate).slice(0, 10);
  const timeKey = normalizeEventTime(eventTime);
  const parsed = new Date(`${dateKey}T${timeKey}:00`);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed;
};

export const formatFollowUpWhenLabel = (
  eventDate: string,
  eventTime?: string | null,
) => {
  const parsed = parseCalendarEventDateTime(eventDate, eventTime);
  if (!parsed) return String(eventDate).slice(0, 10);
  return parsed.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
};

const getContactDisplayName = (contact: ContactRow | null, fallback: string) => {
  if (!contact) return fallback;
  const fullName = `${contact.first_name ?? ""} ${contact.last_name ?? ""}`
    .trim();
  if (fullName && contact.company_name?.trim()) {
    return `${fullName} (${contact.company_name.trim()})`;
  }
  return fullName || contact.company_name?.trim() || fallback;
};

const getContactPrimaryPhone = (contact: ContactRow | null): string | null => {
  if (!contact?.phone_jsonb?.length) return null;
  for (const entry of contact.phone_jsonb) {
    const raw = entry?.number?.trim();
    if (!raw) continue;
    const e164 = toE164(raw);
    if (e164) {
      const digits = e164.replace(/\D/g, "");
      if (digits.length === 11 && digits.startsWith("1")) {
        const area = digits.slice(1, 4);
        const prefix = digits.slice(4, 7);
        const line = digits.slice(7);
        return `(${area}) ${prefix}-${line}`;
      }
      return e164;
    }
    return raw;
  }
  return null;
};

const buildContactPath = (contact: ContactRow | null) => {
  if (!contact?.id) return null;
  const segment = LEAD_STATUSES.has(String(contact.status ?? ""))
    ? "leads"
    : "contacts";
  return `/${segment}/${contact.id}/show`;
};

const formatContextFromDescription = (raw: string | null | undefined) => {
  const lines = raw
    ?.split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
  if (!lines?.length) return null;
  if (lines.length === 1) {
    if (lines[0].startsWith("Lead follow-up scheduled")) return null;
    if (/^.+ → .+$/.test(lines[0])) return null;
    return lines[0];
  }
  return lines.slice(1).join("\n") || null;
};

const buildFollowUpMessage = ({
  kind,
  contactLabel,
  phoneLabel,
  whenLabel,
  actionLabel,
  contextLabel,
  url,
}: {
  kind: FollowUpNotificationKind;
  contactLabel: string;
  phoneLabel: string | null;
  whenLabel: string;
  actionLabel: string;
  contextLabel: string | null;
  url: string | null;
}) => {
  const phoneLine = phoneLabel
    ? `\nLlamar: ${phoneLabel}`
    : "\nLlamar: (sin teléfono en el lead)";
  const actionLine = `\nQué hacer: ${actionLabel}`;
  const contextLine = contextLabel?.trim()
    ? `\n\nDetalle:\n${contextLabel.trim()}`
    : "";
  const openLine = url ? `\n\nAbrir: ${url}` : "";
  if (kind === "reminder") {
    return `⏰ Recordatorio de follow-up\nLead: ${contactLabel}${phoneLine}\nCuándo: ${whenLabel}${actionLine}${contextLine}${openLine}`.slice(
      0,
      1600,
    );
  }

  return `📋 Follow-up agendado\nLead: ${contactLabel}${phoneLine}\nCuándo: ${whenLabel}${actionLine}${contextLine}${openLine}`.slice(
    0,
    1600,
  );
};

export type FollowUpNotificationResult =
  | { ok: true; sent: true; calendarEventId: number }
  | { ok: true; sent: false; reason: string; calendarEventId: number }
  | { ok: false; error: string; calendarEventId: number };

export async function notifyFollowUpForCalendarEvent(
  supabase: SupabaseClient,
  calendarEventId: number,
  kind: FollowUpNotificationKind,
  options?: { appBaseUrl?: string | null },
): Promise<FollowUpNotificationResult> {
  const { data: event, error: eventError } = await supabase
    .from("calendar_events")
    .select(
      "id, org_id, title, event_date, event_time, description, remind_before_minutes, contact_id, organization_member_id, completed_at, follow_up_scheduled_notified_at, follow_up_reminder_sent_at",
    )
    .eq("id", calendarEventId)
    .maybeSingle();

  if (eventError) {
    return {
      ok: false,
      error: eventError.message ?? "Failed to load calendar event",
      calendarEventId,
    };
  }

  const row = event as CalendarEventRow | null;
  if (!row) {
    return { ok: true, sent: false, reason: "not_found", calendarEventId };
  }

  if (row.completed_at) {
    return { ok: true, sent: false, reason: "completed", calendarEventId };
  }

  if (!row.contact_id || !row.organization_member_id) {
    return {
      ok: true,
      sent: false,
      reason: "missing_contact_or_assignee",
      calendarEventId,
    };
  }

  if (kind === "scheduled" && row.follow_up_scheduled_notified_at) {
    return { ok: true, sent: false, reason: "already_scheduled", calendarEventId };
  }

  if (kind === "reminder" && row.follow_up_reminder_sent_at) {
    return { ok: true, sent: false, reason: "already_reminded", calendarEventId };
  }

  let contact: ContactRow | null = null;
  const { data: contactRow } = await supabase
    .from("contacts")
    .select(
      "id, first_name, last_name, company_name, status, lead_stage, phone_jsonb",
    )
    .eq("id", row.contact_id)
    .maybeSingle();
  contact = (contactRow as ContactRow | null) ?? null;

  let settings;
  try {
    settings = await getMessagingSettingsSecrets(row.org_id);
  } catch (error) {
    console.error("[notifyFollowUp] settings error", error);
    return {
      ok: false,
      error: "Failed to load messaging settings",
      calendarEventId,
    };
  }

  const accountSid = settings.twilio_account_sid?.trim();
  const authToken = settings.twilio_auth_token?.trim();
  const fromNumber = settings.twilio_phone_number?.trim();

  if (!settings.sms_enabled || !accountSid || !authToken || !fromNumber) {
    return {
      ok: true,
      sent: false,
      reason: "sms_not_configured",
      calendarEventId,
    };
  }

  const to = await resolveMemberPhone(supabase, row.organization_member_id);
  if (!to) {
    return {
      ok: true,
      sent: false,
      reason: "member_phone_missing",
      calendarEventId,
    };
  }

  const baseUrl = resolveAppBaseUrl(options?.appBaseUrl);
  const contactPath = buildContactPath(contact);
  const url = contactPath && baseUrl ? `${baseUrl}${contactPath}` : contactPath;
  const contactLabel = getContactDisplayName(contact, "Lead");
  const phoneLabel = getContactPrimaryPhone(contact);
  const whenLabel = formatFollowUpWhenLabel(row.event_date, row.event_time);
  const actionLabel = row.title?.trim() || "Follow up con el lead";
  const contextLabel = formatContextFromDescription(row.description);
  const body = buildFollowUpMessage({
    kind,
    contactLabel,
    phoneLabel,
    whenLabel,
    actionLabel,
    contextLabel: contextLabel || null,
    url,
  });

  try {
    await sendTwilioSms({
      accountSid,
      authToken,
      from: fromNumber,
      to,
      body,
    });
  } catch (error) {
    console.error("[notifyFollowUp] Twilio error", { calendarEventId, error });
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Twilio SMS failed",
      calendarEventId,
    };
  }

  const notifiedColumn =
    kind === "scheduled"
      ? "follow_up_scheduled_notified_at"
      : "follow_up_reminder_sent_at";

  const { error: updateError } = await supabase
    .from("calendar_events")
    .update({ [notifiedColumn]: new Date().toISOString() })
    .eq("id", calendarEventId);

  if (updateError) {
    console.error("[notifyFollowUp] failed to mark notified", updateError);
  }

  return { ok: true, sent: true, calendarEventId };
};

export async function processDueCalendarFollowUpReminders(
  supabase: SupabaseClient,
  options?: { appBaseUrl?: string | null },
) {
  const now = Date.now();

  const { data: events, error } = await supabase
    .from("calendar_events")
    .select(
      "id, event_date, event_time, remind_before_minutes, completed_at, follow_up_reminder_sent_at, contact_id, organization_member_id",
    )
    .is("completed_at", null)
    .is("follow_up_reminder_sent_at", null)
    .not("contact_id", "is", null)
    .not("organization_member_id", "is", null);

  if (error) {
    throw new Error(error.message ?? "Failed to load calendar events");
  }

  const results: FollowUpNotificationResult[] = [];

  for (const raw of events ?? []) {
    const event = raw as CalendarEventRow;
    const eventAt = parseCalendarEventDateTime(
      String(event.event_date),
      event.event_time,
    );
    if (!eventAt) continue;

    const remindMinutes =
      event.remind_before_minutes != null &&
      Number.isFinite(Number(event.remind_before_minutes))
        ? Number(event.remind_before_minutes)
        : 15;
    const notifyAt = eventAt.getTime() - remindMinutes * 60 * 1000;

    if (now < notifyAt) continue;

    const result = await notifyFollowUpForCalendarEvent(
      supabase,
      event.id,
      "reminder",
      options,
    );
    results.push(result);
  }

  return results;
};

export function isAuthorizedFollowUpCron(req: Request) {
  const secret = Deno.env.get("CRON_SECRET")?.trim();
  const header = req.headers.get("x-cron-secret")?.trim();
  if (secret && header && secret === header) {
    return true;
  }

  const auth = req.headers.get("authorization")?.trim();
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")?.trim();
  if (serviceKey && auth === `Bearer ${serviceKey}`) {
    return true;
  }

  return false;
}
