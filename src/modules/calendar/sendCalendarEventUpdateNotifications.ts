import type { Identifier, NotificationOptions } from "ra-core";
import type { CrmDataProvider } from "@/components/atomic-crm/providers/types";
import {
  hasCalendarScheduleChanged,
  isVideoMeetingRecord,
} from "@/modules/calendar/calendarEventScheduleUtils";
import { sendMeetingRescheduleNotifications } from "@/modules/meetings/sendMeetingRescheduleNotifications";

type CalendarEventRecord = {
  id?: Identifier;
  title?: string | null;
  event_date?: string | null;
  event_time?: string | null;
  duration_minutes?: number | null;
  meeting_url?: string | null;
};

export const sendCalendarEventUpdateNotifications = async ({
  previous,
  updated,
  dataProvider,
  notify,
  shareEmail = true,
  shareSms = true,
}: {
  previous: CalendarEventRecord;
  updated: CalendarEventRecord;
  dataProvider: CrmDataProvider;
  notify?: (message: string, options?: NotificationOptions) => void;
  shareEmail?: boolean;
  shareSms?: boolean;
}) => {
  if (!hasCalendarScheduleChanged(previous, updated)) {
    return { notified: false as const };
  }

  const eventId = updated.id ?? previous.id;
  if (eventId == null) {
    return { notified: false as const };
  }

  const warnings: string[] = [];

  try {
    const bookingSync = await dataProvider.syncCalendarEventBooking({
      calendarEventId: eventId,
      appBaseUrl:
        typeof window !== "undefined" ? window.location.origin : undefined,
    });

    if (bookingSync.has_booking) {
      if (bookingSync.guest_confirmation?.sent) {
        notify?.("Guest notified about the reschedule", { type: "info" });
      }
      if (bookingSync.host_notify?.sent) {
        notify?.("Team member notified about the booking change", {
          type: "info",
        });
      }
      if (
        bookingSync.guest_confirmation &&
        !bookingSync.guest_confirmation.sent &&
        bookingSync.guest_confirmation.reason === "guest_phone_missing"
      ) {
        warnings.push("Guest SMS skipped — no phone on booking");
      }
      return { notified: true as const, kind: "booking" as const, warnings };
    }
  } catch (error) {
    warnings.push(
      error instanceof Error
        ? error.message
        : "Could not sync public booking",
    );
  }

  if (isVideoMeetingRecord(updated) || isVideoMeetingRecord(previous)) {
    const { errors } = await sendMeetingRescheduleNotifications({
      record: updated,
      shareEmail,
      shareSms,
      dataProvider,
      notify,
    });
    warnings.push(...errors);
    return { notified: true as const, kind: "meeting" as const, warnings };
  }

  try {
    const result = await dataProvider.notifyFollowUp({
      calendarEventId: eventId,
      kind: "rescheduled",
      appBaseUrl:
        typeof window !== "undefined" ? window.location.origin : undefined,
    });
    if (result.sent) {
      notify?.("Assignee notified about the schedule change", { type: "info" });
    } else if (
      result.reason &&
      result.reason !== "missing_contact_or_assignee" &&
      result.reason !== "sms_not_configured"
    ) {
      warnings.push(`Internal notify: ${result.reason}`);
    }
    return { notified: true as const, kind: "follow_up" as const, warnings };
  } catch (error) {
    warnings.push(
      error instanceof Error
        ? error.message
        : "Could not notify assignee",
    );
    return { notified: false as const, warnings };
  }
};
