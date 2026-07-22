import type { CalendarEventRecord } from "@/components/atomic-crm/types";

export type MeetingFormat = "video" | "phone" | "in_person" | "custom_link";

export const MEETING_FORMAT_VALUES: MeetingFormat[] = [
  "video",
  "phone",
  "in_person",
  "custom_link",
];

export const MEETING_FORMAT_CHOICES = [
  { id: "video" as const, name: "Video call" },
  { id: "phone" as const, name: "Phone call" },
  { id: "in_person" as const, name: "In person" },
  { id: "custom_link" as const, name: "Custom link" },
];

export const DEFAULT_MEETING_FORMAT: MeetingFormat = "video";

const isMeetingFormat = (value: unknown): value is MeetingFormat =>
  typeof value === "string" &&
  MEETING_FORMAT_VALUES.includes(value as MeetingFormat);

export const inferMeetingFormat = (
  record: Pick<
    CalendarEventRecord,
    "meeting_format" | "meeting_url" | "location"
  >,
): MeetingFormat => {
  if (isMeetingFormat(record.meeting_format)) {
    return record.meeting_format;
  }
  if (String(record.meeting_url ?? "").trim()) {
    return "video";
  }
  return DEFAULT_MEETING_FORMAT;
};

export const isMeetingRecord = (
  record: Pick<
    CalendarEventRecord,
    "meeting_format" | "meeting_url"
  >,
) => {
  if (isMeetingFormat(record.meeting_format)) return true;
  return Boolean(String(record.meeting_url ?? "").trim());
};

export const isVideoMeetingRecord = (
  record: Pick<
    CalendarEventRecord,
    "meeting_format" | "meeting_url"
  >,
) => {
  if (record.meeting_format === "video") return true;
  if (isMeetingFormat(record.meeting_format)) return false;
  return Boolean(String(record.meeting_url ?? "").trim());
};

export const isCustomLinkMeetingRecord = (
  record: Pick<CalendarEventRecord, "meeting_format">,
) => record.meeting_format === "custom_link";

export const normalizeMeetingFormatWriteData = (
  data: Record<string, unknown>,
) => {
  const next = { ...data };
  const format = isMeetingFormat(next.meeting_format)
    ? next.meeting_format
    : inferMeetingFormat({
        meeting_format: next.meeting_format as string | null | undefined,
        meeting_url: next.meeting_url as string | null | undefined,
        location: next.location as string | null | undefined,
      });

  next.meeting_format = format;

  if (next.location === "") {
    next.location = null;
  }

  if (format === "video") {
    if (next.meeting_url === "") next.meeting_url = null;
  } else if (format === "phone") {
    next.meeting_url = null;
  } else if (format === "in_person") {
    next.meeting_url = null;
  } else if (format === "custom_link") {
    if (next.meeting_url === "") next.meeting_url = null;
    next.location = null;
  }

  return next;
};
