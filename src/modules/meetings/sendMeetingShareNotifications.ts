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

export const sendMeetingShareNotifications = async ({
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
  sendClientSms?: (params: {
    contactId?: Identifier;
    dealId?: Identifier | null;
    body: string;
  }) => Promise<unknown>;
  identity?: { first_name?: string | null; fullName?: string | null } | null;
  orgName?: string | null;
  notify?: (message: string, options?: NotificationOptions) => void;
}) => {
  const eventId = record.id;
  const meetingUrl = String(record.meeting_url ?? "").trim();

  if (eventId == null || !meetingUrl) {
    return { errors: [] as string[] };
  }

  try {
    const result = await dataProvider.notifyMeetingScheduled({
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
        result.client_email.reason !== "already_sent"
      ) {
        errors.push(`Email: ${result.client_email.reason}`);
      }
    }
    if (shareSms && !result.client_sms?.sent && result.client_sms?.reason) {
      if (
        result.client_sms.reason !== "skipped" &&
        result.client_sms.reason !== "already_sent"
      ) {
        errors.push(`SMS: ${result.client_sms.reason}`);
      }
    }
    if (
      !result.host_sms?.sent &&
      result.host_sms?.reason &&
      result.host_sms.reason !== "disabled" &&
      result.host_sms.reason !== "already_sent" &&
      result.host_sms.reason !== "host_phone_missing"
    ) {
      errors.push(`Host SMS: ${result.host_sms.reason}`);
    }

    if (result.client_email?.sent) {
      notify?.("Invitation emailed", { type: "info" });
    }
    if (result.client_sms?.sent) {
      notify?.("Invitation sent via SMS", { type: "info" });
    }
    if (result.host_sms?.sent) {
      notify?.("Host confirmation sent", { type: "info" });
    }
    if (
      !result.host_sms?.sent &&
      result.host_sms?.reason === "host_phone_missing"
    ) {
      notify?.(
        "Host confirmation skipped — add a notification phone in Settings → Notifications → Personal",
        { type: "warning" },
      );
    }

    return { errors, result };
  } catch (error) {
    return {
      errors: [
        error instanceof Error
          ? error.message
          : "Could not send meeting notifications",
      ],
    };
  }
};
