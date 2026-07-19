/**
 * Frontend mirror of edge meetingNotificationCopy — keep SMS preview in sync with send.
 * Edge: supabase/functions/_shared/meetingNotificationCopy.ts
 * Fixture: NY host 11:00 + Chicago client → includes "10:00 AM CT your time".
 */
import {
  DEFAULT_ORG_TIMEZONE,
  formatDateInTimeZone,
  formatTimeInTimeZone,
  inferUsTimezoneFromAddress,
  timezoneShortLabel,
  zonedWallTimeToUtcMs,
} from "@/lib/timezone/usTimezone";

const formatDurationLabel = (minutes?: number | null) => {
  if (minutes == null || minutes <= 0) return null;
  if (minutes === 60) return "1 hour";
  if (minutes % 60 === 0) return `${minutes / 60} hours`;
  if (minutes === 30) return "30 minutes";
  if (minutes === 15) return "15 minutes";
  return `${minutes} min`;
};

type ScheduleParams = {
  eventDate?: string | null;
  eventTime?: string | null;
  durationMinutes?: number | null;
  meetingTimezone?: string | null;
  viewerTimezone?: string | null;
};

export const formatMeetingScheduleLine = ({
  eventDate,
  eventTime,
  durationMinutes,
  meetingTimezone,
  viewerTimezone,
}: ScheduleParams) => {
  if (!eventDate?.trim()) return null;
  const meetingTz = meetingTimezone?.trim() || DEFAULT_ORG_TIMEZONE;
  const timeKey = eventTime?.trim().slice(0, 5) || "09:00";
  const utcMs = zonedWallTimeToUtcMs(eventDate, timeKey, meetingTz);
  if (utcMs == null) return null;

  const dateLabel = formatDateInTimeZone(utcMs, meetingTz);
  const startLabel = formatTimeInTimeZone(utcMs, meetingTz);
  const hostAbbrev = timezoneShortLabel(meetingTz);

  let timeLabel = `${startLabel} ${hostAbbrev}`.trim();
  if (durationMinutes && durationMinutes > 0) {
    const endMs = utcMs + durationMinutes * 60_000;
    const endLabel = formatTimeInTimeZone(endMs, meetingTz);
    timeLabel = `${startLabel} – ${endLabel} ${hostAbbrev}`.trim();
  }

  const durationLabel = formatDurationLabel(durationMinutes);
  let line = durationLabel
    ? `${dateLabel} at ${timeLabel} (${durationLabel})`
    : `${dateLabel} at ${timeLabel}`;

  const viewerTz = viewerTimezone?.trim();
  if (viewerTz && viewerTz !== meetingTz) {
    const localTime = formatTimeInTimeZone(utcMs, viewerTz);
    const localAbbrev = timezoneShortLabel(viewerTz);
    line += ` (${localTime} ${localAbbrev} your time)`;
  }

  return line;
};

export const resolveClientTimezone = (contact?: {
  timezone?: string | null;
  state_abbr?: string | null;
  zipcode?: string | null;
  country?: string | null;
} | null) => {
  const explicit = contact?.timezone?.trim();
  if (explicit) return explicit;
  return (
    inferUsTimezoneFromAddress({
      stateAbbr: contact?.state_abbr,
      zipcode: contact?.zipcode,
      country: contact?.country,
    }) ?? null
  );
};

export const buildClientMeetingConfirmationSmsPreview = ({
  contactFirstName,
  hostFirstName,
  orgName,
  notes,
  meetingUrl,
  calendarUrl,
  eventDate,
  eventTime,
  durationMinutes,
  meetingTimezone,
  clientTimezone,
}: {
  contactFirstName?: string | null;
  hostFirstName?: string | null;
  orgName?: string | null;
  notes?: string | null;
  meetingUrl: string;
  calendarUrl?: string | null;
  eventDate?: string | null;
  eventTime?: string | null;
  durationMinutes?: number | null;
  meetingTimezone?: string | null;
  clientTimezone?: string | null;
}) => {
  const greeting = contactFirstName?.trim()
    ? `Hi ${contactFirstName.trim()},`
    : "Hi,";
  const schedule = formatMeetingScheduleLine({
    eventDate,
    eventTime,
    durationMinutes,
    meetingTimezone,
    viewerTimezone: clientTimezone,
  });
  const lines = [
    greeting,
    "",
    "You're booked for a video call:",
    schedule ?? "See details in your invite.",
    "",
    `Join: ${meetingUrl.trim()}`,
  ];
  if (calendarUrl?.trim()) {
    lines.push(`Add to calendar: ${calendarUrl.trim()}`);
  }
  if (notes?.trim()) {
    lines.splice(2, 0, notes.trim(), "");
  }
  const sender = hostFirstName?.trim() || "Team";
  const org = orgName?.trim() || "Latino Business Support";
  lines.push("", `${sender} from ${org}`);
  return lines.join("\n");
};
