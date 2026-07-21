import type { SupabaseClient } from "jsr:@supabase/supabase-js@2";
import {
  processBookingAfterSubmit,
  type BookingNotificationResult,
} from "./notifyBooking.ts";
import type { FollowUpNotificationResult } from "./notifyFollowUp.ts";

export type SyncCalendarEventBookingResult = {
  has_booking: boolean;
  booking_id?: number | null;
  host_notify?: FollowUpNotificationResult;
  guest_confirmation?: { sent: boolean; reason?: string };
};

export async function syncCalendarEventBookingAfterUpdate(
  supabase: SupabaseClient,
  params: {
    orgId: number;
    calendarEventId: number;
    memberId: number;
    appBaseUrl?: string | null;
  },
): Promise<SyncCalendarEventBookingResult> {
  const { data: event, error: eventError } = await supabase
    .from("calendar_events")
    .select(
      "id, org_id, title, event_date, event_time, duration_minutes, contact_id, deal_id, organization_member_id, completed_at, meeting_url",
    )
    .eq("id", params.calendarEventId)
    .eq("org_id", params.orgId)
    .maybeSingle();

  if (eventError || !event?.id) {
    return { has_booking: false };
  }

  if (event.completed_at || String(event.meeting_url ?? "").trim()) {
    return { has_booking: false };
  }

  const { data: booking, error: bookingError } = await supabase
    .from("public_bookings")
    .select(
      "id, org_id, service_name, guest_name, guest_phone, guest_email, organization_member_id, contact_id, task_id, calendar_event_id, event_date, event_time",
    )
    .eq("calendar_event_id", params.calendarEventId)
    .eq("org_id", params.orgId)
    .maybeSingle();

  if (bookingError || !booking?.id) {
    return { has_booking: false };
  }

  const eventDate = String(event.event_date).slice(0, 10);
  const eventTime = String(event.event_time ?? "").trim().slice(0, 8) || null;

  await supabase
    .from("calendar_events")
    .update({
      follow_up_scheduled_notified_at: null,
      follow_up_reminder_sent_at: null,
      reminder_sent_at: [],
    })
    .eq("id", params.calendarEventId);

  const { error: bookingUpdateError } = await supabase
    .from("public_bookings")
    .update({
      event_date: eventDate,
      event_time: eventTime,
      guest_reminder_sent_at: null,
    })
    .eq("id", booking.id);

  if (bookingUpdateError) {
    console.error(
      "[syncCalendarEventBookingAfterUpdate] booking update failed",
      bookingUpdateError,
    );
  }

  const notifyResult: BookingNotificationResult = await processBookingAfterSubmit(
    supabase,
    {
      bookingId: booking.id,
      calendarEventId: params.calendarEventId,
      orgId: params.orgId,
      contactId: booking.contact_id ?? event.contact_id ?? null,
      organizationMemberId:
        booking.organization_member_id ??
        event.organization_member_id ??
        params.memberId,
      serviceName: booking.service_name,
      guestName: booking.guest_name,
      eventDate,
      eventTime: eventTime ?? "09:00:00",
      dealId: event.deal_id ?? null,
      existingTaskId: booking.task_id ?? null,
      rescheduled: true,
      appBaseUrl: params.appBaseUrl,
    },
  );

  return {
    has_booking: true,
    booking_id: booking.id,
    host_notify: notifyResult.hostNotify,
    guest_confirmation: notifyResult.guestConfirmation,
  };
}
