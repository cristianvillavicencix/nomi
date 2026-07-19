import type { Contact } from "@/components/atomic-crm/types";
import { DEFAULT_ORG_TIMEZONE } from "@/lib/timezone/usTimezone";
import {
  buildClientMeetingConfirmationSmsPreview,
  formatMeetingScheduleLine,
  resolveClientTimezone,
} from "@/modules/meetings/meetingNotificationCopy";

const DEFAULT_INTRO = "Join our video call using the link below:";

export type QuickMeetingShareParts = {
  greeting: string;
  intro: string;
  meetingUrl: string;
  signature: string;
  smsBody: string;
};

export const buildQuickMeetingShareParts = ({
  contact,
  meetingUrl,
  notes,
  senderFirstName,
  orgName,
  eventDate,
  eventTime,
  durationMinutes,
  meetingTimezone,
  calendarUrl,
}: {
  contact?: Contact | null;
  meetingUrl: string;
  notes?: string | null;
  senderFirstName?: string | null;
  orgName?: string | null;
  eventDate?: string | null;
  eventTime?: string | null;
  durationMinutes?: number | null;
  /** Host/workspace IANA timezone (usually America/New_York). */
  meetingTimezone?: string | null;
  calendarUrl?: string | null;
}): QuickMeetingShareParts => {
  const contactFirst = contact?.first_name?.trim();
  const greeting = contactFirst ? `Hi ${contactFirst},` : "Hi,";
  const notesTrimmed = notes?.trim();
  const hostTz = meetingTimezone?.trim() || DEFAULT_ORG_TIMEZONE;
  const clientTz = resolveClientTimezone(contact);
  const scheduledLine = formatMeetingScheduleLine({
    eventDate,
    eventTime,
    durationMinutes,
    meetingTimezone: hostTz,
    viewerTimezone: clientTz,
  });
  const introBody = scheduledLine
    ? `${scheduledLine}\n\n${DEFAULT_INTRO}`
    : DEFAULT_INTRO;
  const sender = senderFirstName?.trim() || "Team";
  const org = orgName?.trim() || "Latino Business Support";
  const signature = `${sender} from ${org}`;
  const url = meetingUrl.trim();

  const smsBody = buildClientMeetingConfirmationSmsPreview({
    contactFirstName: contact?.first_name,
    hostFirstName: senderFirstName,
    orgName,
    notes,
    meetingUrl: url,
    calendarUrl,
    eventDate,
    eventTime,
    durationMinutes,
    meetingTimezone: hostTz,
    clientTimezone: clientTz,
  });

  return {
    greeting,
    intro: notesTrimmed ? `${notesTrimmed}\n\n${introBody}` : introBody,
    meetingUrl: url,
    signature,
    smsBody,
  };
};

export const getSenderFirstName = (
  identity?: {
    first_name?: string | null;
    fullName?: string | null;
  } | null,
) => {
  const fromField = identity?.first_name?.trim();
  if (fromField) return fromField;
  const full = identity?.fullName?.trim();
  if (!full) return "Team";
  return full.split(/\s+/)[0] || "Team";
};
