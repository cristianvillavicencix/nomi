import {
  formatDurationLabel,
  formatEventTimeRange,
} from "@/modules/calendar/calendarReminderOptions";

export const formatMeetingScheduleLine = ({
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

export const formatMeetingTimeOnly = (eventTime?: string | null) => {
  const time = eventTime?.trim().slice(0, 5);
  if (!time) return null;
  const [hours, minutes] = time.split(":").map(Number);
  if (Number.isNaN(hours) || Number.isNaN(minutes)) return null;
  const date = new Date();
  date.setHours(hours, minutes, 0, 0);
  return date.toLocaleTimeString(undefined, {
    hour: "numeric",
    minute: "2-digit",
  });
};

type CopyBase = {
  meetingUrl: string;
  calendarUrl?: string | null;
  eventDate?: string | null;
  eventTime?: string | null;
  durationMinutes?: number | null;
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
  const schedule = formatMeetingScheduleLine(base);
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
  const schedule = formatMeetingScheduleLine(base);
  const lines = [
    `Meeting scheduled with ${who}`,
    schedule ?? "",
    "",
    `Join: ${base.meetingUrl.trim()}`,
  ].filter((line, index, arr) => !(line === "" && arr[index - 1] === ""));
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
  const timeLabel = formatMeetingTimeOnly(base.eventTime);
  const timeHint = timeLabel ? ` (${timeLabel})` : "";
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
  const timeLabel = formatMeetingTimeOnly(base.eventTime);
  const timeHint = timeLabel ? ` (${timeLabel})` : "";
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
  const schedule = formatMeetingScheduleLine(base);
  const introLines = [
    schedule ? `${schedule}\n\nJoin our video call using the link below:` : "Join our video call using the link below:",
  ];
  if (notes?.trim()) {
    introLines.unshift(notes.trim(), "");
  }
  const sender = hostFirstName?.trim() || "Team";
  const org = orgName?.trim() || "Latino Business Support";
  const scheduleSubject = schedule ?? "Video call";
  return {
    greeting,
    intro: introLines.join("\n"),
    signature: `${sender} from ${org}`,
    subjectTitle: title?.trim() || scheduleSubject,
    calendarUrl: base.calendarUrl?.trim() || null,
  };
};
