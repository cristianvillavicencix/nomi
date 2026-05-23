import type { CalendarEventRecord } from "@/components/atomic-crm/types";

export type CalendarEntryKind =
  | "activity"
  | "scheduled_task"
  | "reminder"
  | "meeting";

export const REMIND_BEFORE_NONE = "none";

export const REMIND_BEFORE_CHOICES = [
  { id: REMIND_BEFORE_NONE, name: "No alert" },
  { id: 0, name: "At time of event" },
  { id: 5, name: "5 minutes before" },
  { id: 15, name: "15 minutes before" },
  { id: 30, name: "30 minutes before" },
  { id: 60, name: "1 hour before" },
  { id: 120, name: "2 hours before" },
  { id: 1440, name: "1 day before" },
] as const;

export const DURATION_NONE = "none";

export const DURATION_CHOICES = [
  { id: DURATION_NONE, name: "No duration" },
  { id: 15, name: "15 minutes" },
  { id: 30, name: "30 minutes" },
  { id: 45, name: "45 minutes" },
  { id: 60, name: "1 hour" },
  { id: 90, name: "1.5 hours" },
  { id: 120, name: "2 hours" },
] as const;

export const DEFAULT_MEETING_DURATION_MINUTES = 60;

export const getCalendarEntryKind = (
  record: CalendarEventRecord,
): CalendarEntryKind => {
  if (record.meeting_url?.trim()) return "meeting";
  if (record.contact_id || record.deal_id) return "activity";
  if (record.person_id) return "scheduled_task";
  return "reminder";
};

export const normalizeEventTime = (value?: string | null) => {
  if (!value?.trim()) return null;
  return value.slice(0, 5);
};

export const formatEventTimeLabel = (value?: string | null) => {
  const time = normalizeEventTime(value);
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

export const formatRemindBeforeLabel = (minutes?: number | null) => {
  if (minutes == null) return null;
  const match = REMIND_BEFORE_CHOICES.find((choice) => choice.id === minutes);
  return match?.name ?? `${minutes} minutes before`;
};

const parseEventTimeParts = (value?: string | null) => {
  const time = normalizeEventTime(value);
  if (!time) return null;
  const [hours, minutes] = time.split(":").map(Number);
  if (Number.isNaN(hours) || Number.isNaN(minutes)) return null;
  return { hours, minutes };
};

export const formatDurationLabel = (minutes?: number | null) => {
  if (minutes == null || minutes <= 0) return null;
  const match = DURATION_CHOICES.find((choice) => choice.id === minutes);
  if (match) return match.name;
  if (minutes % 60 === 0) {
    const hours = minutes / 60;
    return hours === 1 ? "1 hour" : `${hours} hours`;
  }
  return `${minutes} min`;
};

export const formatEventTimeRange = (
  eventTime?: string | null,
  durationMinutes?: number | null,
) => {
  const startLabel = formatEventTimeLabel(eventTime);
  if (!startLabel) return null;

  const parts = parseEventTimeParts(eventTime);
  if (!parts || !durationMinutes || durationMinutes <= 0) {
    return startLabel;
  }

  const endDate = new Date();
  endDate.setHours(parts.hours, parts.minutes, 0, 0);
  endDate.setMinutes(endDate.getMinutes() + durationMinutes);

  const endLabel = endDate.toLocaleTimeString(undefined, {
    hour: "numeric",
    minute: "2-digit",
  });

  return `${startLabel} – ${endLabel}`;
};

export const getContactDisplayName = (contact?: {
  first_name?: string | null;
  last_name?: string | null;
  id?: number | string;
}) => {
  if (!contact) return "";
  const name = [contact.first_name, contact.last_name]
    .filter(Boolean)
    .join(" ");
  return name || `Contact #${contact.id}`;
};
