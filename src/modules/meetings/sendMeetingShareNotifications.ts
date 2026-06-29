import type { Identifier, NotificationOptions } from "ra-core";
import type { Contact } from "@/components/atomic-crm/types";
import type { CrmDataProvider } from "@/components/atomic-crm/providers/types";
import {
  buildQuickMeetingShareParts,
  getSenderFirstName,
} from "@/modules/meetings/quickMeetingShareMessage";

type MeetingShareRecord = {
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
  sendClientSms,
  identity,
  orgName,
  notify,
}: {
  record: MeetingShareRecord;
  shareEmail: boolean;
  shareSms: boolean;
  dataProvider: CrmDataProvider;
  sendClientSms: (params: {
    contactId?: Identifier;
    dealId?: Identifier | null;
    body: string;
  }) => Promise<unknown>;
  identity?: { first_name?: string | null; fullName?: string | null } | null;
  orgName?: string | null;
  notify?: (message: string, options?: NotificationOptions) => void;
}) => {
  const contactId = record.contact_id;
  const meetingUrl = String(record.meeting_url ?? "").trim();
  const title = String(record.title ?? "").trim();

  if (!contactId || !meetingUrl) return { errors: [] as string[] };

  const contact = (
    await dataProvider.getOne("contacts_summary", { id: contactId })
  ).data as Contact;

  const share = buildQuickMeetingShareParts({
    contact,
    meetingUrl,
    notes: record.description,
    senderFirstName: getSenderFirstName(identity),
    orgName,
    eventDate: record.event_date,
    eventTime: record.event_time,
    durationMinutes: record.duration_minutes,
  });

  const errors: string[] = [];

  if (shareEmail) {
    try {
      const result = await dataProvider.sendMeetingLink({
        contactId,
        meetingUrl,
        title: title || "Video call",
        greeting: share.greeting,
        intro: share.intro,
        signature: share.signature,
      });
      notify?.(`Invitation emailed to ${result.to}`, { type: "info" });
    } catch (error) {
      errors.push(
        error instanceof Error ? error.message : "Could not send email",
      );
    }
  }

  if (shareSms) {
    try {
      await sendClientSms({
        contactId,
        dealId: record.deal_id ?? null,
        body: share.smsBody,
      });
      notify?.("Invitation sent via SMS", { type: "info" });
    } catch (error) {
      errors.push(
        error instanceof Error ? error.message : "Could not send SMS",
      );
    }
  }

  return { errors };
};
