import type { SupabaseClient } from "jsr:@supabase/supabase-js@2";
import { getMessagingSettingsSecrets } from "./messagingSettings.ts";
import { normalizeUsPhoneToE164 } from "./phone.ts";
import { sendTwilioSms } from "./twilio.ts";
import {
  formatFollowUpWhenLabel,
  notifyFollowUpForCalendarEvent,
  parseCalendarEventDateTime,
} from "./notifyFollowUp.ts";
import { getBookingStartMs } from "./bookingUtils.ts";

type BookingRow = {
  id: number;
  org_id: number;
  service_name: string;
  organization_member_id: number | null;
  contact_id: number | null;
  calendar_event_id: number | null;
  guest_name: string;
  guest_phone: string | null;
  guest_email: string | null;
  event_date: string;
  event_time: string;
  task_id: number | null;
  guest_confirmation_sent_at?: string | null;
  guest_reminder_sent_at?: string | null;
};

const toE164 = (phone: string): string | null => {
  const trimmed = phone.trim();
  if (!trimmed) return null;
  if (trimmed.startsWith("+") && /^\+[1-9]\d{1,14}$/.test(trimmed)) {
    return trimmed;
  }
  return normalizeUsPhoneToE164(trimmed);
};

const resolveHostName = async (
  supabase: SupabaseClient,
  memberId: number | null,
) => {
  if (memberId == null) return null;
  const { data: host } = await supabase
    .from("organization_members")
    .select("first_name, last_name")
    .eq("id", memberId)
    .maybeSingle();
  const parts = [host?.first_name, host?.last_name]
    .map((part) => String(part ?? "").trim())
    .filter(Boolean);
  return parts.length > 0 ? parts.join(" ") : null;
};

const buildGuestConfirmationBody = ({
  guestName,
  serviceName,
  whenLabel,
  hostName,
  rescheduled,
}: {
  guestName: string;
  serviceName: string;
  whenLabel: string;
  hostName: string | null;
  rescheduled: boolean;
}) => {
  const intro = rescheduled
    ? "Your appointment was rescheduled."
    : "Your appointment is confirmed.";
  const hostLine = hostName ? `\nWith: ${hostName}` : "";
  return `${intro}\n\nService: ${serviceName}\nWhen: ${whenLabel}${hostLine}\n\nReply if you need to make changes.`.slice(
    0,
    1600,
  );
};

const buildGuestReminderBody = ({
  serviceName,
  whenLabel,
  hostName,
  remindMinutes,
}: {
  serviceName: string;
  whenLabel: string;
  hostName: string | null;
  remindMinutes: number;
}) => {
  const hostLine = hostName ? `\nWith: ${hostName}` : "";
  return `Reminder: your appointment is in ${remindMinutes} minutes.\n\nService: ${serviceName}\nWhen: ${whenLabel}${hostLine}`.slice(
    0,
    1600,
  );
};

export const createOrUpdateBookingPrepTask = async (
  supabase: SupabaseClient,
  input: {
    orgId: number;
    contactId: number | null;
    organizationMemberId: number | null;
    serviceName: string;
    guestName: string;
    eventDate: string;
    eventTime: string;
    existingTaskId?: number | null;
    dealId?: number | null;
  },
): Promise<number | null> => {
  const eventAt = parseCalendarEventDateTime(input.eventDate, input.eventTime);
  if (!eventAt || input.organizationMemberId == null) return null;

  const taskText = `Prep for booking: ${input.serviceName} with ${input.guestName}`;
  const payload = {
    org_id: input.orgId,
    contact_id: input.contactId,
    organization_member_id: input.organizationMemberId,
    deal_id: input.dealId ?? null,
    text: taskText,
    due_date: eventAt.toISOString(),
    type: "call",
    priority: "normal",
    internal: false,
  };

  if (input.existingTaskId) {
    const { data, error } = await supabase
      .from("tasks")
      .update({
        text: taskText,
        due_date: eventAt.toISOString(),
        contact_id: input.contactId,
      })
      .eq("id", input.existingTaskId)
      .select("id")
      .maybeSingle();

    if (error) {
      console.error("[notifyBooking] task update failed", error);
      return input.existingTaskId;
    }
    return data?.id ?? input.existingTaskId;
  }

  if (!input.contactId) return null;

  const { data, error } = await supabase
    .from("tasks")
    .insert(payload)
    .select("id")
    .single();

  if (error || !data?.id) {
    console.error("[notifyBooking] task insert failed", error);
    return null;
  }

  return data.id;
};

export const sendGuestBookingConfirmationSms = async (
  supabase: SupabaseClient,
  bookingId: number,
  options?: { rescheduled?: boolean },
): Promise<{ sent: boolean; reason?: string }> => {
  const { data: booking, error } = await supabase
    .from("public_bookings")
    .select(
      "id, org_id, service_name, organization_member_id, guest_name, guest_phone, event_date, event_time, guest_confirmation_sent_at",
    )
    .eq("id", bookingId)
    .maybeSingle();

  if (error || !booking) {
    return { sent: false, reason: "booking_not_found" };
  }

  const row = booking as BookingRow;
  if (!options?.rescheduled && row.guest_confirmation_sent_at) {
    return { sent: false, reason: "already_sent" };
  }

  const guestPhone = row.guest_phone ? toE164(row.guest_phone) : null;
  if (!guestPhone) {
    return { sent: false, reason: "guest_phone_missing" };
  }

  let settings;
  try {
    settings = await getMessagingSettingsSecrets(row.org_id);
  } catch {
    return { sent: false, reason: "settings_error" };
  }

  const accountSid = settings.twilio_account_sid?.trim();
  const authToken = settings.twilio_auth_token?.trim();
  const fromNumber = settings.twilio_phone_number?.trim();

  if (!settings.sms_enabled || !accountSid || !authToken || !fromNumber) {
    return { sent: false, reason: "sms_not_configured" };
  }

  const hostName = await resolveHostName(supabase, row.organization_member_id);
  const whenLabel = formatFollowUpWhenLabel(row.event_date, row.event_time);
  const body = buildGuestConfirmationBody({
    guestName: row.guest_name,
    serviceName: row.service_name,
    whenLabel,
    hostName,
    rescheduled: options?.rescheduled === true,
  });

  try {
    await sendTwilioSms({
      accountSid,
      authToken,
      from: fromNumber,
      to: guestPhone,
      body,
    });
  } catch (sendError) {
    console.error("[notifyBooking] guest confirmation SMS failed", sendError);
    return { sent: false, reason: "twilio_error" };
  }

  await supabase
    .from("public_bookings")
    .update({ guest_confirmation_sent_at: new Date().toISOString() })
    .eq("id", bookingId);

  return { sent: true };
};

export const sendGuestBookingReminderSms = async (
  supabase: SupabaseClient,
  bookingId: number,
  remindMinutes: number,
): Promise<{ sent: boolean; reason?: string }> => {
  const { data: booking, error } = await supabase
    .from("public_bookings")
    .select(
      "id, org_id, service_name, organization_member_id, guest_phone, event_date, event_time, guest_reminder_sent_at, status",
    )
    .eq("id", bookingId)
    .maybeSingle();

  if (error || !booking) {
    return { sent: false, reason: "booking_not_found" };
  }

  const row = booking as BookingRow;
  if (row.status !== "confirmed") {
    return { sent: false, reason: "not_confirmed" };
  }
  if (row.guest_reminder_sent_at) {
    return { sent: false, reason: "already_sent" };
  }

  const guestPhone = row.guest_phone ? toE164(row.guest_phone) : null;
  if (!guestPhone) {
    return { sent: false, reason: "guest_phone_missing" };
  }

  let settings;
  try {
    settings = await getMessagingSettingsSecrets(row.org_id);
  } catch {
    return { sent: false, reason: "settings_error" };
  }

  const accountSid = settings.twilio_account_sid?.trim();
  const authToken = settings.twilio_auth_token?.trim();
  const fromNumber = settings.twilio_phone_number?.trim();

  if (!settings.sms_enabled || !accountSid || !authToken || !fromNumber) {
    return { sent: false, reason: "sms_not_configured" };
  }

  const hostName = await resolveHostName(supabase, row.organization_member_id);
  const whenLabel = formatFollowUpWhenLabel(row.event_date, row.event_time);
  const body = buildGuestReminderBody({
    serviceName: row.service_name,
    whenLabel,
    hostName,
    remindMinutes,
  });

  try {
    await sendTwilioSms({
      accountSid,
      authToken,
      from: fromNumber,
      to: guestPhone,
      body,
    });
  } catch (sendError) {
    console.error("[notifyBooking] guest reminder SMS failed", sendError);
    return { sent: false, reason: "twilio_error" };
  }

  await supabase
    .from("public_bookings")
    .update({ guest_reminder_sent_at: new Date().toISOString() })
    .eq("id", bookingId);

  return { sent: true };
};

export type BookingNotificationResult = {
  ok: boolean;
  hostNotify?: Awaited<ReturnType<typeof notifyFollowUpForCalendarEvent>>;
  guestConfirmation?: { sent: boolean; reason?: string };
  taskId?: number | null;
};

export async function processBookingAfterSubmit(
  supabase: SupabaseClient,
  input: {
    bookingId: number | null;
    calendarEventId: number;
    orgId: number;
    contactId: number | null;
    organizationMemberId: number | null;
    serviceName: string;
    guestName: string;
    eventDate: string;
    eventTime: string;
    dealId?: number | null;
    existingTaskId?: number | null;
    rescheduled?: boolean;
    appBaseUrl?: string | null;
  },
): Promise<BookingNotificationResult> {
  const taskId = await createOrUpdateBookingPrepTask(supabase, {
    orgId: input.orgId,
    contactId: input.contactId,
    organizationMemberId: input.organizationMemberId,
    serviceName: input.serviceName,
    guestName: input.guestName,
    eventDate: input.eventDate,
    eventTime: input.eventTime,
    existingTaskId: input.existingTaskId,
    dealId: input.dealId,
  });

  if (input.bookingId != null && taskId != null) {
    await supabase
      .from("public_bookings")
      .update({ task_id: taskId })
      .eq("id", input.bookingId);
  }

  const hostNotify = await notifyFollowUpForCalendarEvent(
    supabase,
    input.calendarEventId,
    input.rescheduled ? "rescheduled" : "scheduled",
    { appBaseUrl: input.appBaseUrl },
  );

  let guestConfirmation: { sent: boolean; reason?: string } | undefined;
  if (input.bookingId != null) {
    guestConfirmation = await sendGuestBookingConfirmationSms(
      supabase,
      input.bookingId,
      { rescheduled: input.rescheduled === true },
    );
  }

  return {
    ok: true,
    hostNotify,
    guestConfirmation,
    taskId,
  };
}

export async function processDueBookingGuestReminders(
  supabase: SupabaseClient,
) {
  const now = Date.now();

  const { data: bookings, error } = await supabase
    .from("public_bookings")
    .select(
      "id, event_date, event_time, guest_phone, guest_reminder_sent_at, status, calendar_event_id",
    )
    .eq("status", "confirmed")
    .is("guest_reminder_sent_at", null)
    .not("guest_phone", "is", null);

  if (error) {
    throw new Error(error.message ?? "Failed to load bookings");
  }

  const results: Array<{ bookingId: number; sent: boolean; reason?: string }> =
    [];

  for (const raw of bookings ?? []) {
    const booking = raw as BookingRow;
    const eventTime = String(booking.event_time ?? "").slice(0, 5);
    const startMs = getBookingStartMs(String(booking.event_date), eventTime);
    if (!Number.isFinite(startMs)) continue;

    if (now >= startMs) {
      await supabase
        .from("public_bookings")
        .update({ guest_reminder_sent_at: new Date().toISOString() })
        .eq("id", booking.id)
        .is("guest_reminder_sent_at", null);
      continue;
    }

    let remindMinutes = 15;
    if (booking.calendar_event_id != null) {
      const { data: event } = await supabase
        .from("calendar_events")
        .select("remind_before_minutes")
        .eq("id", booking.calendar_event_id)
        .maybeSingle();
      if (
        event?.remind_before_minutes != null &&
        Number.isFinite(Number(event.remind_before_minutes))
      ) {
        remindMinutes = Number(event.remind_before_minutes);
      }
    }

    const notifyAt = startMs - remindMinutes * 60 * 1000;
    if (now < notifyAt) continue;

    const result = await sendGuestBookingReminderSms(
      supabase,
      booking.id,
      remindMinutes,
    );
    results.push({
      bookingId: booking.id,
      sent: result.sent,
      reason: result.reason,
    });
  }

  return results;
}
