import type { SupabaseClient } from "jsr:@supabase/supabase-js@2";
import { generateSecureToken } from "./formV2Schema.ts";
import { generateUniqueShortCode } from "./formTokenUtils.ts";
import { getMessagingSettingsSecrets } from "./messagingSettings.ts";
import {
  buildClientMeetingConfirmationSms,
  buildClientMeetingEmailParts,
  buildClientMeetingReminderSms,
  buildClientMeetingRescheduleSms,
  buildHostMeetingConfirmationSms,
  buildHostMeetingRescheduleSms,
  buildHostMeetingReminderSms,
} from "./meetingNotificationCopy.ts";
import {
  normalizeMeetingNotificationSettings,
  type MeetingNotificationSettings,
} from "./meetingNotificationSettings.ts";
import { normalizeUsPhoneToE164 } from "./phone.ts";
import { resolvePublicAppBaseUrl } from "./publicAppUrl.ts";
import {
  DEFAULT_ORG_TIMEZONE,
  inferUsTimezoneFromAddress,
  zonedWallTimeToUtcMs,
} from "./usTimezone.ts";
import { normalizeBookingSettings } from "./bookingUtils.ts";
import {
  isOrgTransactionalEmailConfigured,
  sendTransactionalEmail,
} from "./transactionalEmail.ts";
import { resolveOrgGeneralFrom } from "./organizationEmailSenders.ts";
import { resolveContactEmail } from "./clientProposalBilling.ts";
import { sendOrgSms as sendOrgSmsMessage } from "./sendOrgSms.ts";
import {
  ensureClientConversation,
  insertSmsMessage,
  touchConversationFirstResponse,
} from "./messagingConversations.ts";

type MeetingEventRow = {
  id: number;
  org_id: number;
  title?: string | null;
  description?: string | null;
  event_date: string;
  event_time?: string | null;
  duration_minutes?: number | null;
  meeting_url?: string | null;
  timezone?: string | null;
  contact_id?: number | null;
  deal_id?: number | null;
  organization_member_id?: number | null;
  assignee_member_ids?: number[] | null;
  completed_at?: string | null;
  host_confirmation_sent_at?: string | null;
  meeting_client_invite_sent_at?: string | null;
  host_reminder_15_sent_at?: string | null;
  host_reminder_5_sent_at?: string | null;
  client_reminder_15_sent_at?: string | null;
  client_reminder_5_sent_at?: string | null;
};

const resolveMeetingAssigneeMemberIds = (
  row: Pick<
    MeetingEventRow,
    "assignee_member_ids" | "organization_member_id"
  >,
  fallbackMemberId: number,
) => {
  const fromArray = Array.isArray(row.assignee_member_ids)
    ? row.assignee_member_ids
        .map((id) => Number(id))
        .filter((id) => Number.isFinite(id))
    : [];
  if (fromArray.length > 0) {
    return [...new Set(fromArray)];
  }
  const owner = Number(row.organization_member_id);
  if (Number.isFinite(owner)) return [owner];
  return [fallbackMemberId];
};

const toE164 = (phone: string): string | null => {
  const trimmed = phone.trim();
  if (!trimmed) return null;
  if (trimmed.startsWith("+") && /^\+[1-9]\d{1,14}$/.test(trimmed)) {
    return trimmed;
  }
  return normalizeUsPhoneToE164(trimmed);
};

const extractPrimaryPhone = (phoneJsonb: unknown): string | null => {
  if (!Array.isArray(phoneJsonb)) return null;
  for (const entry of phoneJsonb) {
    if (!entry || typeof entry !== "object") continue;
    const number = (entry as { number?: string }).number;
    if (typeof number === "string" && number.trim()) {
      const normalized = toE164(number);
      if (normalized) return normalized;
    }
  }
  return null;
};

export const resolveMemberNotificationPhone = async (
  supabase: SupabaseClient,
  memberId: number,
): Promise<string | null> => {
  const { data: member } = await supabase
    .from("organization_members")
    .select("notification_phone, user_id, first_name, last_name")
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
  if (authPhone) return toE164(authPhone);

  const metaPhone =
    typeof authData.user.user_metadata?.phone === "string"
      ? authData.user.user_metadata.phone.trim()
      : "";
  if (metaPhone) return toE164(metaPhone);

  return null;
};

export async function loadOrgMeetingNotificationSettings(
  supabase: SupabaseClient,
  orgId: number,
): Promise<MeetingNotificationSettings> {
  const { data } = await supabase
    .from("organizations")
    .select("meeting_notification_settings, name")
    .eq("id", orgId)
    .maybeSingle();
  return normalizeMeetingNotificationSettings(
    data?.meeting_notification_settings,
  );
}

export async function ensurePublicCalendarEventShare(
  supabase: SupabaseClient,
  params: {
    orgId: number;
    calendarEventId: number;
    createdByMemberId?: number | null;
    baseUrl?: string | null;
  },
): Promise<{ shortCode: string; token: string; calendarUrl: string } | null> {
  const { data: existing } = await supabase
    .from("public_calendar_event_tokens")
    .select("token, short_code")
    .eq("calendar_event_id", params.calendarEventId)
    .eq("org_id", params.orgId)
    .maybeSingle();

  let token = existing?.token as string | undefined;
  let shortCode = existing?.short_code as string | undefined;

  if (!token || !shortCode) {
    token = generateSecureToken();
    shortCode = await generateUniqueShortCode(async (code) => {
      const { data } = await supabase
        .from("public_calendar_event_tokens")
        .select("id")
        .eq("short_code", code)
        .maybeSingle();
      return Boolean(data?.id);
    });

    const { error } = await supabase.from("public_calendar_event_tokens").upsert(
      {
        token,
        short_code: shortCode,
        org_id: params.orgId,
        calendar_event_id: params.calendarEventId,
        created_by_member_id: params.createdByMemberId ?? null,
      },
      { onConflict: "calendar_event_id" },
    );
    if (error) {
      console.error("ensurePublicCalendarEventShare.insert", error);
      return null;
    }
  }

  const base =
    params.baseUrl?.replace(/\/$/, "") || resolvePublicAppBaseUrl();
  return {
    token,
    shortCode,
    calendarUrl: `${base}/c/${shortCode}`,
  };
}

const escapeHtml = (value: string) =>
  value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

async function sendOrgSms(
  orgId: number,
  to: string,
  body: string,
  options?: {
    /** When set, also write the SMS into Messages (client conversation). */
    logToConversation?: boolean;
    contactId?: number | null;
    dealId?: number | null;
    memberId?: number | null;
    contactTitle?: string | null;
  },
): Promise<{ ok: true } | { ok: false; reason: string }> {
  let settings;
  try {
    settings = await getMessagingSettingsSecrets(orgId);
  } catch {
    return { ok: false, reason: "sms_settings_error" };
  }
  if (!settings?.sms_enabled) {
    return { ok: false, reason: "sms_not_configured" };
  }
  try {
    const sendResult = await sendOrgSmsMessage({
      orgId,
      to,
      body,
    });

    if (options?.logToConversation && options.contactId) {
      try {
        const conversation = await ensureClientConversation({
          orgId,
          externalPhone: to,
          contactId: options.contactId,
          dealId: options.dealId ?? null,
          createdByMemberId: options.memberId ?? null,
          title: options.contactTitle ?? null,
        });
        const message = await insertSmsMessage({
          conversationId: Number(conversation.id),
          body,
          direction: "outbound",
          authorMemberId: options.memberId ?? null,
          externalId: sendResult.sid ?? sendResult.id ?? null,
          smsDeliveryStatus: sendResult.status ?? "queued",
        });
        void message;
      } catch (logError) {
        console.warn("[notifyMeeting] SMS conversation log failed", logError);
      }
    }

    return { ok: true };
  } catch (error) {
    console.error("[notifyMeeting] SMS send failed", error);
    return {
      ok: false,
      reason: error instanceof Error ? error.message : "sms_send_failed",
    };
  }
}

export type NotifyMeetingScheduledResult = {
  calendar_url: string | null;
  host_sms: { sent: boolean; reason?: string };
  client_email: { sent: boolean; reason?: string };
  client_sms: { sent: boolean; reason?: string };
};

/**
 * After a video meeting is created: calendar short link, host SMS, client invite.
 * Quick calls (start within ~2 minutes) still get confirmations; cron skips past events.
 */
export async function notifyMeetingScheduled(
  supabase: SupabaseClient,
  params: {
    orgId: number;
    calendarEventId: number;
    memberId: number;
    shareEmail?: boolean;
    shareSms?: boolean;
    forceHostConfirm?: boolean;
    appBaseUrl?: string | null;
  },
): Promise<NotifyMeetingScheduledResult> {
  const result: NotifyMeetingScheduledResult = {
    calendar_url: null,
    host_sms: { sent: false },
    client_email: { sent: false },
    client_sms: { sent: false },
  };

  const { data: event } = await supabase
    .from("calendar_events")
    .select(
      "id, org_id, title, description, event_date, event_time, duration_minutes, meeting_url, timezone, contact_id, deal_id, organization_member_id, assignee_member_ids, completed_at, host_confirmation_sent_at, meeting_client_invite_sent_at",
    )
    .eq("id", params.calendarEventId)
    .eq("org_id", params.orgId)
    .maybeSingle();

  const row = event as MeetingEventRow | null;
  if (!row?.id || !row.meeting_url?.trim()) {
    result.host_sms.reason = "not_a_meeting";
    return result;
  }

  const settings = await loadOrgMeetingNotificationSettings(
    supabase,
    params.orgId,
  );

  const { data: org } = await supabase
    .from("organizations")
    .select("name, booking_settings")
    .eq("id", params.orgId)
    .maybeSingle();
  const orgName = org?.name?.trim() || "Latino Business Support";
  const bookingTz =
    normalizeBookingSettings(org?.booking_settings).timezone_label ||
    DEFAULT_ORG_TIMEZONE;
  let meetingTimezone = row.timezone?.trim() || bookingTz;
  if (!row.timezone?.trim()) {
    await supabase
      .from("calendar_events")
      .update({ timezone: meetingTimezone })
      .eq("id", row.id);
    row.timezone = meetingTimezone;
  }

  const { data: hostMember } = await supabase
    .from("organization_members")
    .select("id, first_name, last_name")
    .eq("id", row.organization_member_id ?? params.memberId)
    .maybeSingle();

  let contact: {
    id: number;
    first_name?: string | null;
    last_name?: string | null;
    phone_jsonb?: unknown;
    timezone?: string | null;
    state_abbr?: string | null;
    zipcode?: string | null;
    country?: string | null;
  } | null = null;
  if (row.contact_id) {
    const { data } = await supabase
      .from("contacts")
      .select(
        "id, first_name, last_name, phone_jsonb, timezone, state_abbr, zipcode, country",
      )
      .eq("id", row.contact_id)
      .maybeSingle();
    contact = data;
  }

  let clientTimezone =
    contact?.timezone?.trim() ||
    inferUsTimezoneFromAddress({
      stateAbbr: contact?.state_abbr,
      zipcode: contact?.zipcode,
      country: contact?.country,
    });
  if (contact?.id && !contact.timezone?.trim() && clientTimezone) {
    await supabase
      .from("contacts")
      .update({ timezone: clientTimezone })
      .eq("id", contact.id);
  }

  const contactName =
    `${contact?.first_name ?? ""} ${contact?.last_name ?? ""}`.trim() || null;

  let calendarUrl: string | null = null;
  if (settings.include_add_to_calendar_link) {
    const share = await ensurePublicCalendarEventShare(supabase, {
      orgId: params.orgId,
      calendarEventId: row.id,
      createdByMemberId: params.memberId,
      baseUrl: params.appBaseUrl,
    });
    calendarUrl = share?.calendarUrl ?? null;
    result.calendar_url = calendarUrl;
  }

  const copyBase = {
    meetingUrl: row.meeting_url.trim(),
    calendarUrl,
    eventDate: row.event_date,
    eventTime: row.event_time,
    durationMinutes: row.duration_minutes,
    meetingTimezone,
    clientTimezone,
  };

  const wantHost =
    params.forceHostConfirm !== false && settings.host_confirmation_on_create;
  if (wantHost && !row.host_confirmation_sent_at) {
    const assigneeIds = resolveMeetingAssigneeMemberIds(row, params.memberId);
    let anySent = false;
    let lastReason: string | undefined;

    for (const assigneeId of assigneeIds) {
      const hostPhone = await resolveMemberNotificationPhone(
        supabase,
        assigneeId,
      );
      if (!hostPhone) {
        lastReason = "host_phone_missing";
        continue;
      }
      const body = buildHostMeetingConfirmationSms({
        ...copyBase,
        contactName,
      });
      const sms = await sendOrgSms(params.orgId, hostPhone, body);
      if (sms.ok) {
        anySent = true;
      } else {
        lastReason = sms.reason;
      }
    }

    if (anySent) {
      await supabase
        .from("calendar_events")
        .update({ host_confirmation_sent_at: new Date().toISOString() })
        .eq("id", row.id);
      result.host_sms = { sent: true };
    } else {
      result.host_sms = {
        sent: false,
        reason: lastReason ?? "host_phone_missing",
      };
    }
  } else if (!wantHost) {
    result.host_sms = { sent: false, reason: "disabled" };
  } else {
    result.host_sms = { sent: false, reason: "already_sent" };
  }

  const shareEmail = params.shareEmail === true;
  const shareSms = params.shareSms === true;

  if (!row.contact_id || (!shareEmail && !shareSms)) {
    if (!shareEmail && !shareSms) {
      result.client_email = { sent: false, reason: "skipped" };
      result.client_sms = { sent: false, reason: "skipped" };
    } else {
      result.client_email = { sent: false, reason: "no_contact" };
      result.client_sms = { sent: false, reason: "no_contact" };
    }
    return result;
  }

  const emailParts = buildClientMeetingEmailParts({
    ...copyBase,
    contactFirstName: contact?.first_name,
    hostFirstName: hostMember?.first_name,
    orgName,
    notes: row.description,
    title: row.title,
  });

  if (shareEmail) {
    try {
      const to = await resolveContactEmail(supabase, row.contact_id);
      if (!to) {
        result.client_email = { sent: false, reason: "no_email" };
      } else if (!(await isOrgTransactionalEmailConfigured(params.orgId))) {
        result.client_email = { sent: false, reason: "email_not_configured" };
      } else {
        const generalFrom = await resolveOrgGeneralFrom(params.orgId, orgName);
        const calendarLine = emailParts.calendarUrl
          ? `\n\nAdd to calendar: ${emailParts.calendarUrl}`
          : "";
        const textBody = [
          emailParts.greeting,
          "",
          emailParts.intro,
          copyBase.meetingUrl,
          calendarLine.trim(),
          "",
          emailParts.signature,
        ]
          .filter(Boolean)
          .join("\n");
        const introHtml = escapeHtml(emailParts.intro).replace(/\n/g, "<br>");
        const calendarHtml = emailParts.calendarUrl
          ? `<p style="margin:0 0 16px;"><a href="${escapeHtml(emailParts.calendarUrl)}" style="color:#378ADD;font-weight:600;">Add to calendar</a></p>`
          : "";
        const htmlBody = `
          <div style="font-family:system-ui,-apple-system,sans-serif;color:#0f172a;line-height:1.6;max-width:520px;margin:0 auto;">
            <p style="margin:0 0 16px;font-size:16px;">${escapeHtml(emailParts.greeting)}</p>
            <p style="margin:0 0 20px;font-size:15px;color:#334155;">${introHtml}</p>
            <p style="margin:0 0 16px;">
              <a href="${escapeHtml(copyBase.meetingUrl)}" style="display:inline-block;background:#378ADD;color:#ffffff;padding:12px 22px;border-radius:8px;text-decoration:none;font-weight:600;font-size:15px;">Join video call</a>
            </p>
            ${calendarHtml}
            <p style="margin:0;font-size:14px;color:#64748b;">${escapeHtml(emailParts.signature)}</p>
          </div>`;
        await sendTransactionalEmail({
          orgId: params.orgId,
          orgName,
          to,
          subject: `${orgName}: ${emailParts.subjectTitle}`,
          textBody,
          htmlBody,
          fromEmail: generalFrom.email,
          fromName: generalFrom.name,
          replyTo: generalFrom.email,
          emailChannel: "general",
        });
        result.client_email = { sent: true };
      }
    } catch (error) {
      result.client_email = {
        sent: false,
        reason: error instanceof Error ? error.message : "email_failed",
      };
    }
  } else {
    result.client_email = { sent: false, reason: "skipped" };
  }

  if (shareSms) {
    const phone = extractPrimaryPhone(contact?.phone_jsonb);
    if (!phone) {
      result.client_sms = { sent: false, reason: "no_phone" };
    } else {
      const body = buildClientMeetingConfirmationSms({
        ...copyBase,
        contactFirstName: contact?.first_name,
        hostFirstName: hostMember?.first_name,
        orgName,
        notes: row.description,
      });
      const sms = await sendOrgSms(params.orgId, phone, body, {
        logToConversation: true,
        contactId: contact?.id ?? row.contact_id,
        dealId: row.deal_id ?? null,
        memberId: params.memberId,
        contactTitle: contactName,
      });
      result.client_sms = sms.ok
        ? { sent: true }
        : { sent: false, reason: sms.reason };
    }
  } else {
    result.client_sms = { sent: false, reason: "skipped" };
  }

  if (result.client_email.sent || result.client_sms.sent) {
    await supabase
      .from("calendar_events")
      .update({ meeting_client_invite_sent_at: new Date().toISOString() })
      .eq("id", row.id);
  }

  return result;
}

/** Notify host + optional client when a video meeting is rescheduled from CRM. */
export async function notifyMeetingRescheduled(
  supabase: SupabaseClient,
  params: {
    orgId: number;
    calendarEventId: number;
    memberId: number;
    shareEmail?: boolean;
    shareSms?: boolean;
    appBaseUrl?: string | null;
  },
): Promise<NotifyMeetingScheduledResult> {
  const result: NotifyMeetingScheduledResult = {
    calendar_url: null,
    host_sms: { sent: false },
    client_email: { sent: false },
    client_sms: { sent: false },
  };

  await supabase
    .from("calendar_events")
    .update({
      host_reminder_15_sent_at: null,
      host_reminder_5_sent_at: null,
      client_reminder_15_sent_at: null,
      client_reminder_5_sent_at: null,
    })
    .eq("id", params.calendarEventId)
    .eq("org_id", params.orgId);

  const { data: event } = await supabase
    .from("calendar_events")
    .select(
      "id, org_id, title, description, event_date, event_time, duration_minutes, meeting_url, timezone, contact_id, deal_id, organization_member_id, assignee_member_ids, completed_at",
    )
    .eq("id", params.calendarEventId)
    .eq("org_id", params.orgId)
    .maybeSingle();

  const row = event as MeetingEventRow | null;
  if (!row?.id || !row.meeting_url?.trim()) {
    result.host_sms.reason = "not_a_meeting";
    return result;
  }

  if (row.completed_at) {
    result.host_sms.reason = "completed";
    return result;
  }

  const settings = await loadOrgMeetingNotificationSettings(
    supabase,
    params.orgId,
  );

  const { data: org } = await supabase
    .from("organizations")
    .select("name, booking_settings")
    .eq("id", params.orgId)
    .maybeSingle();
  const orgName = org?.name?.trim() || "Latino Business Support";
  const bookingTz =
    normalizeBookingSettings(org?.booking_settings).timezone_label ||
    DEFAULT_ORG_TIMEZONE;
  const meetingTimezone = row.timezone?.trim() || bookingTz;

  const { data: hostMember } = await supabase
    .from("organization_members")
    .select("id, first_name, last_name")
    .eq("id", row.organization_member_id ?? params.memberId)
    .maybeSingle();

  let contact: {
    id: number;
    first_name?: string | null;
    last_name?: string | null;
    phone_jsonb?: unknown;
    timezone?: string | null;
    state_abbr?: string | null;
    zipcode?: string | null;
    country?: string | null;
  } | null = null;
  if (row.contact_id) {
    const { data } = await supabase
      .from("contacts")
      .select(
        "id, first_name, last_name, phone_jsonb, timezone, state_abbr, zipcode, country",
      )
      .eq("id", row.contact_id)
      .maybeSingle();
    contact = data;
  }

  let clientTimezone =
    contact?.timezone?.trim() ||
    inferUsTimezoneFromAddress({
      stateAbbr: contact?.state_abbr,
      zipcode: contact?.zipcode,
      country: contact?.country,
    });

  const contactName =
    `${contact?.first_name ?? ""} ${contact?.last_name ?? ""}`.trim() || null;

  let calendarUrl: string | null = null;
  if (settings.include_add_to_calendar_link) {
    const share = await ensurePublicCalendarEventShare(supabase, {
      orgId: params.orgId,
      calendarEventId: row.id,
      createdByMemberId: params.memberId,
      baseUrl: params.appBaseUrl,
    });
    calendarUrl = share?.calendarUrl ?? null;
    result.calendar_url = calendarUrl;
  }

  const copyBase = {
    meetingUrl: row.meeting_url.trim(),
    calendarUrl,
    eventDate: row.event_date,
    eventTime: row.event_time,
    durationMinutes: row.duration_minutes,
    meetingTimezone,
    clientTimezone,
  };

  if (settings.host_confirmation_on_create) {
    const assigneeIds = resolveMeetingAssigneeMemberIds(row, params.memberId);
    let anySent = false;
    let lastReason: string | undefined;

    for (const assigneeId of assigneeIds) {
      const hostPhone = await resolveMemberNotificationPhone(
        supabase,
        assigneeId,
      );
      if (!hostPhone) {
        lastReason = "host_phone_missing";
        continue;
      }
      const body = buildHostMeetingRescheduleSms({
        ...copyBase,
        contactName,
      });
      const sms = await sendOrgSms(params.orgId, hostPhone, body);
      if (sms.ok) {
        anySent = true;
      } else {
        lastReason = sms.reason;
      }
    }

    result.host_sms = anySent
      ? { sent: true }
      : { sent: false, reason: lastReason ?? "host_phone_missing" };
  } else {
    result.host_sms = { sent: false, reason: "disabled" };
  }

  const shareEmail = params.shareEmail === true;
  const shareSms = params.shareSms === true;

  if (!row.contact_id || (!shareEmail && !shareSms)) {
    if (!shareEmail && !shareSms) {
      result.client_email = { sent: false, reason: "skipped" };
      result.client_sms = { sent: false, reason: "skipped" };
    } else {
      result.client_email = { sent: false, reason: "no_contact" };
      result.client_sms = { sent: false, reason: "no_contact" };
    }
    return result;
  }

  const emailParts = buildClientMeetingEmailParts({
    ...copyBase,
    contactFirstName: contact?.first_name,
    hostFirstName: hostMember?.first_name,
    orgName,
    notes: row.description,
    title: row.title,
  });

  if (shareEmail) {
    try {
      const to = await resolveContactEmail(supabase, row.contact_id);
      if (!to) {
        result.client_email = { sent: false, reason: "no_email" };
      } else if (!(await isOrgTransactionalEmailConfigured(params.orgId))) {
        result.client_email = { sent: false, reason: "email_not_configured" };
      } else {
        const generalFrom = await resolveOrgGeneralFrom(params.orgId, orgName);
        const introCore = emailParts.intro.replace(
          "Join our video call using the link below:",
          "Your video call was rescheduled. Join using the link below:",
        );
        const calendarLine = emailParts.calendarUrl
          ? `\n\nAdd to calendar: ${emailParts.calendarUrl}`
          : "";
        const textBody = [
          emailParts.greeting,
          "",
          introCore,
          copyBase.meetingUrl,
          calendarLine.trim(),
          "",
          emailParts.signature,
        ]
          .filter(Boolean)
          .join("\n");
        const introHtml = escapeHtml(introCore).replace(/\n/g, "<br>");
        const calendarHtml = emailParts.calendarUrl
          ? `<p style="margin:0 0 16px;"><a href="${escapeHtml(emailParts.calendarUrl)}" style="color:#378ADD;font-weight:600;">Add to calendar</a></p>`
          : "";
        const htmlBody = `
          <div style="font-family:system-ui,-apple-system,sans-serif;color:#0f172a;line-height:1.6;max-width:520px;margin:0 auto;">
            <p style="margin:0 0 16px;font-size:16px;">${escapeHtml(emailParts.greeting)}</p>
            <p style="margin:0 0 20px;font-size:15px;color:#334155;">${introHtml}</p>
            <p style="margin:0 0 16px;">
              <a href="${escapeHtml(copyBase.meetingUrl)}" style="display:inline-block;background:#378ADD;color:#ffffff;padding:12px 22px;border-radius:8px;text-decoration:none;font-weight:600;font-size:15px;">Join video call</a>
            </p>
            ${calendarHtml}
            <p style="margin:0;font-size:14px;color:#64748b;">${escapeHtml(emailParts.signature)}</p>
          </div>`;
        await sendTransactionalEmail({
          orgId: params.orgId,
          orgName,
          to,
          subject: `${orgName}: Rescheduled — ${emailParts.subjectTitle}`,
          textBody,
          htmlBody,
          fromEmail: generalFrom.email,
          fromName: generalFrom.name,
          replyTo: generalFrom.email,
          emailChannel: "general",
        });
        result.client_email = { sent: true };
      }
    } catch (error) {
      result.client_email = {
        sent: false,
        reason: error instanceof Error ? error.message : "email_failed",
      };
    }
  } else {
    result.client_email = { sent: false, reason: "skipped" };
  }

  if (shareSms) {
    const phone = extractPrimaryPhone(contact?.phone_jsonb);
    if (!phone) {
      result.client_sms = { sent: false, reason: "no_phone" };
    } else {
      const body = buildClientMeetingRescheduleSms({
        ...copyBase,
        contactFirstName: contact?.first_name,
        hostFirstName: hostMember?.first_name,
        orgName,
        notes: row.description,
      });
      const sms = await sendOrgSms(params.orgId, phone, body, {
        logToConversation: true,
        contactId: contact?.id ?? row.contact_id,
        dealId: row.deal_id ?? null,
        memberId: params.memberId,
        contactTitle: contactName,
      });
      result.client_sms = sms.ok
        ? { sent: true }
        : { sent: false, reason: sms.reason };
    }
  } else {
    result.client_sms = { sent: false, reason: "skipped" };
  }

  return result;
}

type ReminderOffset = 15 | 5;
type ReminderAudience = "host" | "client";

const reminderColumn = (
  audience: ReminderAudience,
  minutes: ReminderOffset,
): keyof MeetingEventRow => {
  if (audience === "host") {
    return minutes === 15
      ? "host_reminder_15_sent_at"
      : "host_reminder_5_sent_at";
  }
  return minutes === 15
    ? "client_reminder_15_sent_at"
    : "client_reminder_5_sent_at";
};

const reminderEnabled = (
  settings: MeetingNotificationSettings,
  audience: ReminderAudience,
  minutes: ReminderOffset,
) => {
  if (audience === "host") {
    return minutes === 15
      ? settings.remind_host_at_15
      : settings.remind_host_at_5;
  }
  return minutes === 15
    ? settings.remind_client_at_15
    : settings.remind_client_at_5;
};

export type MeetingReminderResult = {
  calendarEventId: number;
  audience: ReminderAudience;
  minutes: ReminderOffset;
  sent: boolean;
  reason?: string;
};

export async function processDueMeetingReminders(
  supabase: SupabaseClient,
  options?: { appBaseUrl?: string | null },
): Promise<MeetingReminderResult[]> {
  const now = Date.now();
  const results: MeetingReminderResult[] = [];

  const { data: events, error } = await supabase
    .from("calendar_events")
    .select(
      "id, org_id, title, description, event_date, event_time, duration_minutes, meeting_url, timezone, contact_id, deal_id, organization_member_id, completed_at, host_reminder_15_sent_at, host_reminder_5_sent_at, client_reminder_15_sent_at, client_reminder_5_sent_at",
    )
    .is("completed_at", null)
    .not("meeting_url", "is", null)
    .not("contact_id", "is", null)
    .not("organization_member_id", "is", null);

  if (error) {
    throw new Error(error.message ?? "Failed to load meeting events");
  }

  const settingsByOrg = new Map<number, MeetingNotificationSettings>();
  const orgTzByOrg = new Map<number, string>();

  for (const raw of events ?? []) {
    const event = raw as MeetingEventRow;
    if (!event.meeting_url?.trim()) continue;

    let orgTz = orgTzByOrg.get(event.org_id);
    if (!orgTz) {
      const { data: org } = await supabase
        .from("organizations")
        .select("booking_settings")
        .eq("id", event.org_id)
        .maybeSingle();
      orgTz =
        normalizeBookingSettings(org?.booking_settings).timezone_label ||
        DEFAULT_ORG_TIMEZONE;
      orgTzByOrg.set(event.org_id, orgTz);
    }

    const meetingTimezone = event.timezone?.trim() || orgTz;
    const timeKey = event.event_time?.trim().slice(0, 5) || "09:00";
    const eventAtMs = zonedWallTimeToUtcMs(
      String(event.event_date),
      timeKey,
      meetingTimezone,
    );
    if (eventAtMs == null) continue;

    // Past meetings: stamp all pending reminder columns without SMS.
    if (now >= eventAtMs) {
      const patch: Record<string, string> = {};
      const stamp = new Date().toISOString();
      for (const minutes of [15, 5] as ReminderOffset[]) {
        for (const audience of ["host", "client"] as ReminderAudience[]) {
          const col = reminderColumn(audience, minutes);
          if (!event[col]) patch[col] = stamp;
        }
      }
      if (Object.keys(patch).length > 0) {
        await supabase
          .from("calendar_events")
          .update(patch)
          .eq("id", event.id);
      }
      continue;
    }

    let settings = settingsByOrg.get(event.org_id);
    if (!settings) {
      settings = await loadOrgMeetingNotificationSettings(
        supabase,
        event.org_id,
      );
      settingsByOrg.set(event.org_id, settings);
    }

    let calendarUrl: string | null = null;
    if (settings.include_add_to_calendar_link) {
      const share = await ensurePublicCalendarEventShare(supabase, {
        orgId: event.org_id,
        calendarEventId: event.id,
        baseUrl: options?.appBaseUrl,
      });
      calendarUrl = share?.calendarUrl ?? null;
    }

    const { data: contact } = await supabase
      .from("contacts")
      .select(
        "id, first_name, last_name, phone_jsonb, timezone, state_abbr, zipcode, country",
      )
      .eq("id", event.contact_id!)
      .maybeSingle();
    const contactName =
      `${contact?.first_name ?? ""} ${contact?.last_name ?? ""}`.trim() || null;
    const clientTimezone =
      contact?.timezone?.trim() ||
      inferUsTimezoneFromAddress({
        stateAbbr: contact?.state_abbr,
        zipcode: contact?.zipcode,
        country: contact?.country,
      });

    const { data: hostMember } = await supabase
      .from("organization_members")
      .select("id, first_name")
      .eq("id", event.organization_member_id!)
      .maybeSingle();

    const copyBase = {
      meetingUrl: event.meeting_url.trim(),
      calendarUrl,
      eventDate: event.event_date,
      eventTime: event.event_time,
      durationMinutes: event.duration_minutes,
      meetingTimezone,
      clientTimezone,
    };

    for (const minutes of [15, 5] as ReminderOffset[]) {
      for (const audience of ["host", "client"] as ReminderAudience[]) {
        const col = reminderColumn(audience, minutes);
        if (event[col]) continue;
        if (!reminderEnabled(settings, audience, minutes)) {
          await supabase
            .from("calendar_events")
            .update({ [col]: new Date().toISOString() })
            .eq("id", event.id)
            .is(col, null);
          results.push({
            calendarEventId: event.id,
            audience,
            minutes,
            sent: false,
            reason: "disabled",
          });
          continue;
        }

        const notifyAt = eventAtMs - minutes * 60 * 1000;
        if (now < notifyAt) continue;

        let to: string | null = null;
        let body = "";
        if (audience === "host") {
          to = await resolveMemberNotificationPhone(
            supabase,
            Number(event.organization_member_id),
          );
          body = buildHostMeetingReminderSms({
            ...copyBase,
            minutesBefore: minutes,
            contactName,
          });
        } else {
          to = extractPrimaryPhone(contact?.phone_jsonb);
          body = buildClientMeetingReminderSms({
            ...copyBase,
            minutesBefore: minutes,
            hostFirstName: hostMember?.first_name,
          });
        }

        if (!to) {
          results.push({
            calendarEventId: event.id,
            audience,
            minutes,
            sent: false,
            reason: "phone_missing",
          });
          continue;
        }

        const sms = await sendOrgSms(
          event.org_id,
          to,
          body,
          audience === "client"
            ? {
                logToConversation: true,
                contactId: contact?.id ?? event.contact_id,
                dealId: event.deal_id ?? null,
                memberId: event.organization_member_id,
                contactTitle: contactName,
              }
            : undefined,
        );
        if (sms.ok) {
          await supabase
            .from("calendar_events")
            .update({ [col]: new Date().toISOString() })
            .eq("id", event.id)
            .is(col, null);
          results.push({
            calendarEventId: event.id,
            audience,
            minutes,
            sent: true,
          });
        } else {
          results.push({
            calendarEventId: event.id,
            audience,
            minutes,
            sent: false,
            reason: sms.reason,
          });
        }
      }
    }
  }

  return results;
}
