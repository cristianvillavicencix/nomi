import type { Identifier, NotificationOptions } from "ra-core";
import type { CrmDataProvider } from "@/components/atomic-crm/providers/types";

type MeetingShareRecord = {
  id?: Identifier;
  contact_id?: Identifier | null;
  deal_id?: Identifier | null;
  title?: string | null;
  description?: string | null;
  meeting_url?: string | null;
  event_date?: string | null;
  event_time?: string | null;
  duration_minutes?: number | null;
};

export const sendMeetingRescheduleNotifications = async ({
  record,
  shareEmail,
  shareSms,
  dataProvider,
  notify,
}: {
  record: MeetingShareRecord;
  shareEmail: boolean;
  shareSms: boolean;
  dataProvider: CrmDataProvider;
  notify?: (message: string, options?: NotificationOptions) => void;
}) => {
  const eventId = record.id;
  const meetingUrl = String(record.meeting_url ?? "").trim();

  if (eventId == null || !meetingUrl) {
    return { errors: [] as string[] };
  }

  try {
    const result = await dataProvider.notifyMeetingRescheduled({
      calendarEventId: eventId,
      shareEmail,
      shareSms,
      appBaseUrl:
        typeof window !== "undefined" ? window.location.origin : undefined,
    });

    const errors: string[] = [];
    if (shareEmail && !result.client_email?.sent && result.client_email?.reason) {
      if (
        result.client_email.reason !== "skipped" &&
        result.client_email.reason !== "no_contact"
      ) {
        errors.push(`Email: ${result.client_email.reason}`);
      }
    }
    if (shareSms && !result.client_sms?.sent && result.client_sms?.reason) {
      if (
        result.client_sms.reason !== "skipped" &&
        result.client_sms.reason !== "no_contact" &&
        result.client_sms.reason !== "no_phone"
      ) {
        errors.push(`SMS: ${result.client_sms.reason}`);
      }
    }
    if (
      !result.host_sms?.sent &&
      result.host_sms?.reason &&
      result.host_sms.reason !== "disabled" &&
      result.host_sms.reason !== "host_phone_missing"
    ) {
      errors.push(`Host SMS: ${result.host_sms.reason}`);
    }

    if (result.client_email?.sent) {
      notify?.("Reschedule emailed to client", { type: "info" });
    }
    if (result.client_sms?.sent) {
      notify?.("Reschedule sent to client via SMS", { type: "info" });
    }
    if (result.host_sms?.sent) {
      notify?.("Host notified about the reschedule", { type: "info" });
    }
    if (
      !result.host_sms?.sent &&
      result.host_sms?.reason === "host_phone_missing"
    ) {
      notify?.(
        "Host SMS skipped — add a notification phone in Settings → Notifications → Personal",
        { type: "warning" },
      );
    }

    return { errors, result };
  } catch (error) {
    return {
      errors: [
        error instanceof Error
          ? error.message
          : "Could not send meeting reschedule notifications",
      ],
    };
  }
};
