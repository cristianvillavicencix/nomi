/** English SMS/email copy for video meeting notifications (edge). */

import {
  DEFAULT_ORG_TIMEZONE,
  formatDateInTimeZone,
  formatTimeInTimeZone,
  timezoneShortLabel,
  zonedWallTimeToUtcMs,
} from "./usTimezone.ts";

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

type CopyBase = {
  meetingUrl: string;
  calendarUrl?: string | null;
  eventDate?: string | null;
  eventTime?: string | null;
  durationMinutes?: number | null;
  meetingTimezone?: string | null;
  clientTimezone?: string | null;
};

export const buildClientMeetingConfirmationSms = ({
  contactFirstName,
  hostFirstName,
  orgName,
  notes,
  ...base
}: CopyBase & {
  contactFirstName?: string | null;
  hostFirstName?: string | null;
  orgName?: string | null;
  notes?: string | null;
}) => {
  const greeting = contactFirstName?.trim()
    ? `Hi ${contactFirstName.trim()},`
    : "Hi,";
  const schedule = formatMeetingScheduleLine({
    ...base,
    viewerTimezone: base.clientTimezone,
  });
  const lines = [
    greeting,
    "",
    "You're booked for a video call:",
    schedule ?? "See details in your invite.",
    "",
    `Join: ${base.meetingUrl.trim()}`,
  ];
  if (base.calendarUrl?.trim()) {
    lines.push(`Add to calendar: ${base.calendarUrl.trim()}`);
  }
  if (notes?.trim()) {
    lines.splice(2, 0, notes.trim(), "");
  }
  const sender = hostFirstName?.trim() || "Team";
  const org = orgName?.trim() || "Latino Business Support";
  lines.push("", `${sender} from ${org}`);
  return lines.join("\n");
};

export const buildHostMeetingConfirmationSms = ({
  contactName,
  ...base
}: CopyBase & { contactName?: string | null }) => {
  const who = contactName?.trim() || "your contact";
  const schedule = formatMeetingScheduleLine({
    ...base,
    viewerTimezone: null,
  });
  const lines = [
    `Meeting scheduled with ${who}`,
    ...(schedule ? [schedule] : []),
    "",
    `Join: ${base.meetingUrl.trim()}`,
  ];
  if (base.calendarUrl?.trim()) {
    lines.push(`Add to calendar: ${base.calendarUrl.trim()}`);
  }
  return lines.join("\n");
};

export const buildClientMeetingReminderSms = ({
  minutesBefore,
  hostFirstName,
  ...base
}: CopyBase & {
  minutesBefore: 15 | 5;
  hostFirstName?: string | null;
}) => {
  const host = hostFirstName?.trim() || "your host";
  const meetingTz = base.meetingTimezone?.trim() || DEFAULT_ORG_TIMEZONE;
  const timeKey = base.eventTime?.trim().slice(0, 5) || "09:00";
  const utcMs = base.eventDate
    ? zonedWallTimeToUtcMs(String(base.eventDate), timeKey, meetingTz)
    : null;
  const viewerTz = base.clientTimezone?.trim() || meetingTz;
  const timeLabel =
    utcMs != null ? formatTimeInTimeZone(utcMs, viewerTz) : null;
  const abbrev = timezoneShortLabel(viewerTz);
  const timeHint = timeLabel ? ` (${timeLabel} ${abbrev})` : "";

  if (minutesBefore === 5) {
    return [
      "Your video call starts in 5 minutes.",
      "",
      `Join now: ${base.meetingUrl.trim()}`,
    ].join("\n");
  }
  const lines = [
    `Reminder: video call with ${host} starts in 15 minutes${timeHint}.`,
    "",
    `Join: ${base.meetingUrl.trim()}`,
  ];
  if (base.calendarUrl?.trim()) {
    lines.push(`Add to calendar: ${base.calendarUrl.trim()}`);
  }
  return lines.join("\n");
};

export const buildHostMeetingReminderSms = ({
  minutesBefore,
  contactName,
  ...base
}: CopyBase & {
  minutesBefore: 15 | 5;
  contactName?: string | null;
}) => {
  const who = contactName?.trim() || "your contact";
  const meetingTz = base.meetingTimezone?.trim() || DEFAULT_ORG_TIMEZONE;
  const timeKey = base.eventTime?.trim().slice(0, 5) || "09:00";
  const utcMs = base.eventDate
    ? zonedWallTimeToUtcMs(String(base.eventDate), timeKey, meetingTz)
    : null;
  const timeLabel =
    utcMs != null ? formatTimeInTimeZone(utcMs, meetingTz) : null;
  const abbrev = timezoneShortLabel(meetingTz);
  const timeHint = timeLabel ? ` (${timeLabel} ${abbrev})` : "";

  if (minutesBefore === 5) {
    return [
      `Video call with ${who} starts in 5 minutes.`,
      "",
      `Join now: ${base.meetingUrl.trim()}`,
    ].join("\n");
  }
  return [
    `Reminder: video call with ${who} starts in 15 minutes${timeHint}.`,
    "",
    `Join: ${base.meetingUrl.trim()}`,
  ].join("\n");
};

export const buildClientMeetingEmailParts = ({
  contactFirstName,
  hostFirstName,
  orgName,
  notes,
  title,
  ...base
}: CopyBase & {
  contactFirstName?: string | null;
  hostFirstName?: string | null;
  orgName?: string | null;
  notes?: string | null;
  title?: string | null;
}) => {
  const greeting = contactFirstName?.trim()
    ? `Hi ${contactFirstName.trim()},`
    : "Hi,";
  const schedule = formatMeetingScheduleLine({
    ...base,
    viewerTimezone: base.clientTimezone,
  });
  const introCore = schedule
    ? `${schedule}\n\nJoin our video call using the link below:`
    : "Join our video call using the link below:";
  const intro = notes?.trim()
    ? `${notes.trim()}\n\n${introCore}`
    : introCore;
  const sender = hostFirstName?.trim() || "Team";
  const org = orgName?.trim() || "Latino Business Support";
  return {
    greeting,
    intro,
    signature: `${sender} from ${org}`,
    subjectTitle: title?.trim() || schedule || "Video call",
    calendarUrl: base.calendarUrl?.trim() || null,
  };
};
