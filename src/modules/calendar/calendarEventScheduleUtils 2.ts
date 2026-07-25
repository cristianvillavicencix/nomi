type ScheduleFields = {
  event_date?: string | null;
  event_time?: string | null;
  duration_minutes?: number | null;
  title?: string | null;
};

const normalizeDate = (value?: string | null) =>
  value?.trim().slice(0, 10) ?? "";

const normalizeTime = (value?: string | null) => {
  const trimmed = value?.trim();
  if (!trimmed) return null;
  return trimmed.slice(0, 5);
};

export const hasCalendarScheduleChanged = (
  previous: ScheduleFields | null | undefined,
  next: ScheduleFields | null | undefined,
) => {
  if (!previous || !next) return false;

  if (normalizeDate(previous.event_date) !== normalizeDate(next.event_date)) {
    return true;
  }

  if (normalizeTime(previous.event_time) !== normalizeTime(next.event_time)) {
    return true;
  }

  const prevDuration = previous.duration_minutes ?? null;
  const nextDuration = next.duration_minutes ?? null;
  if (prevDuration !== nextDuration) return true;

  const prevTitle = previous.title?.trim() ?? "";
  const nextTitle = next.title?.trim() ?? "";
  return prevTitle !== nextTitle;
};

export {
  isMeetingRecord,
  isVideoMeetingRecord,
} from "@/modules/meetings/meetingFormat";
