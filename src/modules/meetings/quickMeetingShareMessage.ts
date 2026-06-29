import type { Contact } from "@/components/atomic-crm/types";
import {
  formatDurationLabel,
  formatEventTimeRange,
} from "@/modules/calendar/calendarReminderOptions";

const DEFAULT_INTRO = "Join our video call using the link below:";

export type QuickMeetingShareParts = {
  greeting: string;
  intro: string;
  meetingUrl: string;
  signature: string;
  smsBody: string;
};

const formatScheduledMeetingLine = ({
  eventDate,
  eventTime,
  durationMinutes,
}: {
  eventDate?: string | null;
  eventTime?: string | null;
  durationMinutes?: number | null;
}) => {
  if (!eventDate?.trim()) return null;
  const dateLabel = new Date(`${eventDate}T12:00:00`).toLocaleDateString(
    undefined,
    { weekday: "long", month: "long", day: "numeric" },
  );
  const timeLabel = formatEventTimeRange(eventTime, durationMinutes);
  if (!timeLabel) return dateLabel;
  const durationLabel = formatDurationLabel(durationMinutes);
  return durationLabel
    ? `${dateLabel} at ${timeLabel} (${durationLabel})`
    : `${dateLabel} at ${timeLabel}`;
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
}: {
  contact?: Contact | null;
  meetingUrl: string;
  notes?: string | null;
  senderFirstName?: string | null;
  orgName?: string | null;
  eventDate?: string | null;
  eventTime?: string | null;
  durationMinutes?: number | null;
}): QuickMeetingShareParts => {
  const contactFirst = contact?.first_name?.trim();
  const greeting = contactFirst ? `Hi ${contactFirst},` : "Hi,";
  const notesTrimmed = notes?.trim();
  const scheduledLine = formatScheduledMeetingLine({
    eventDate,
    eventTime,
    durationMinutes,
  });
  const introBody = scheduledLine
    ? `${scheduledLine}\n\n${DEFAULT_INTRO}`
    : DEFAULT_INTRO;
  const sender = senderFirstName?.trim() || "Team";
  const org = orgName?.trim() || "Latino Business Support";
  const signature = `${sender} from ${org}`;
  const url = meetingUrl.trim();

  const smsBody = notesTrimmed
    ? [greeting, "", notesTrimmed, "", introBody, url, "", signature].join("\n")
    : [greeting, "", introBody, url, "", signature].join("\n");

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
