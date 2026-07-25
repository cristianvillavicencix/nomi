import type { CalendarEvent } from "@/modules/calendar/calendarUtils";
import { DEFAULT_MEETING_DURATION_MINUTES } from "@/modules/calendar/calendarReminderOptions";

export const GRID_START_HOUR = 7;
export const GRID_END_HOUR = 19;
export const HOUR_SLOT_HEIGHT_PX = 56;
export const MIN_EVENT_HEIGHT_PX = 28;

export const parseTimeToMinutes = (time?: string | null): number | null => {
  if (!time?.trim()) return null;
  const [hoursRaw, minutesRaw] = time.split(":");
  const hours = Number(hoursRaw);
  const minutes = Number(minutesRaw ?? 0);
  if (!Number.isFinite(hours)) return null;
  return hours * 60 + (Number.isFinite(minutes) ? minutes : 0);
};

export const formatMinutesAsTime = (totalMinutes: number) => {
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:00`;
};

export const getEventStartMinutes = (event: CalendarEvent): number | null => {
  if ("time" in event && event.time) {
    return parseTimeToMinutes(event.time);
  }
  return null;
};

export const getEventDurationMinutes = (event: CalendarEvent): number => {
  if ("record" in event && event.record.duration_minutes) {
    return event.record.duration_minutes;
  }
  if (event.kind === "meeting") {
    return DEFAULT_MEETING_DURATION_MINUTES;
  }
  return 30;
};

export type TimedCalendarBlock = {
  event: CalendarEvent;
  topPx: number;
  heightPx: number;
};

export const splitTimedAndUntimedEvents = (events: CalendarEvent[]) => {
  const timed: CalendarEvent[] = [];
  const untimed: CalendarEvent[] = [];

  for (const event of events) {
    const startMinutes = getEventStartMinutes(event);
    if (startMinutes == null) {
      untimed.push(event);
      continue;
    }
    timed.push(event);
  }

  return { timed, untimed };
};

export const layoutTimedEvents = (
  events: CalendarEvent[],
  {
    startHour = GRID_START_HOUR,
    endHour = GRID_END_HOUR,
    hourSlotHeightPx = HOUR_SLOT_HEIGHT_PX,
  }: {
    startHour?: number;
    endHour?: number;
    hourSlotHeightPx?: number;
  } = {},
): TimedCalendarBlock[] => {
  const gridStartMinutes = startHour * 60;
  const gridEndMinutes = endHour * 60;
  const pxPerMinute = hourSlotHeightPx / 60;

  return events
    .map((event) => {
      const startMinutes = getEventStartMinutes(event);
      if (startMinutes == null) return null;

      const durationMinutes = getEventDurationMinutes(event);
      const clampedStart = Math.max(startMinutes, gridStartMinutes);
      const clampedEnd = Math.min(
        startMinutes + durationMinutes,
        gridEndMinutes,
      );
      if (clampedEnd <= clampedStart) return null;

      const topPx = (clampedStart - gridStartMinutes) * pxPerMinute;
      const heightPx = Math.max(
        MIN_EVENT_HEIGHT_PX,
        (clampedEnd - clampedStart) * pxPerMinute,
      );

      return { event, topPx, heightPx };
    })
    .filter((block): block is TimedCalendarBlock => block != null)
    .sort((left, right) => left.topPx - right.topPx);
};

export const getCurrentTimeIndicator = (
  now = new Date(),
  {
    startHour = GRID_START_HOUR,
    endHour = GRID_END_HOUR,
    hourSlotHeightPx = HOUR_SLOT_HEIGHT_PX,
  }: {
    startHour?: number;
    endHour?: number;
    hourSlotHeightPx?: number;
  } = {},
) => {
  const minutes = now.getHours() * 60 + now.getMinutes();
  const gridStartMinutes = startHour * 60;
  const gridEndMinutes = endHour * 60;
  if (minutes < gridStartMinutes || minutes > gridEndMinutes) {
    return null;
  }

  const pxPerMinute = hourSlotHeightPx / 60;
  return {
    topPx: (minutes - gridStartMinutes) * pxPerMinute,
    label: now.toLocaleTimeString(undefined, {
      hour: "numeric",
      minute: "2-digit",
    }),
  };
};

export const getHourLabels = (
  startHour = GRID_START_HOUR,
  endHour = GRID_END_HOUR,
) => {
  const labels: string[] = [];
  for (let hour = startHour; hour < endHour; hour += 1) {
    const date = new Date();
    date.setHours(hour, 0, 0, 0);
    labels.push(
      date.toLocaleTimeString(undefined, {
        hour: "numeric",
        minute: "2-digit",
      }),
    );
  }
  return labels;
};
