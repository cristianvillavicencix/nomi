import type { CalendarEventRecord, Task } from "@/components/atomic-crm/types";
import { combineTaskDueDateTime, extractTaskDueTime } from "@/components/atomic-crm/tasks/taskDueDateTime";
import { prepareCalendarEventWriteData } from "@/modules/calendar/calendarEventWriteData";
import { normalizeEventTime } from "@/modules/calendar/calendarReminderOptions";
import {
  isCalendarEntryEvent,
  parseDateKey,
  type CalendarEvent,
} from "@/modules/calendar/calendarUtils";

export const CALENDAR_EVENT_DRAG_PREFIX = "calendar-event:";
export const CALENDAR_DAY_DROP_PREFIX = "calendar-day:";
export const CALENDAR_SLOT_DROP_PREFIX = "calendar-slot:";

export const getCalendarEventDragId = (event: CalendarEvent) =>
  `${CALENDAR_EVENT_DRAG_PREFIX}${event.id}`;

export const getCalendarDayDropId = (dateKey: string) =>
  `${CALENDAR_DAY_DROP_PREFIX}${dateKey}`;

export const getCalendarSlotDropId = (dateKey: string, time: string) =>
  `${CALENDAR_SLOT_DROP_PREFIX}${dateKey}:${time}`;

export const parseCalendarDayDropId = (id: string) =>
  id.startsWith(CALENDAR_DAY_DROP_PREFIX)
    ? id.slice(CALENDAR_DAY_DROP_PREFIX.length)
    : null;

export const parseCalendarSlotDropId = (id: string) => {
  if (!id.startsWith(CALENDAR_SLOT_DROP_PREFIX)) return null;
  const payload = id.slice(CALENDAR_SLOT_DROP_PREFIX.length);
  const separatorIndex = payload.indexOf(":");
  if (separatorIndex <= 0) return null;

  const dateKey = payload.slice(0, separatorIndex);
  const time = payload.slice(separatorIndex + 1);
  if (!dateKey || !time) return null;

  return { dateKey, time };
};

export const parseCalendarDropTarget = (id: string) => {
  const slot = parseCalendarSlotDropId(id);
  if (slot) return slot;

  const dateKey = parseCalendarDayDropId(id);
  return dateKey ? { dateKey, time: undefined } : null;
};

/** Project milestones are derived from deals — not user-reschedulable from the calendar. */
export const canRescheduleCalendarEvent = (event: CalendarEvent) =>
  event.kind === "task" || isCalendarEntryEvent(event);

export const getEventRescheduleTime = (event: CalendarEvent): string | null => {
  if (event.kind === "task") {
    return extractTaskDueTime(event.task.due_date);
  }
  if ("time" in event && event.time) {
    return event.time;
  }
  return null;
};

const normalizeRescheduleTime = (time?: string | null) => {
  if (time == null || time === "") return null;
  return normalizeEventTime(time);
};

export const hasRescheduleTargetChanged = (
  event: CalendarEvent,
  targetDateKey: string,
  targetTime?: string | null,
) => {
  if (event.date !== targetDateKey) return true;
  if (targetTime === undefined) return false;

  return (
    normalizeRescheduleTime(targetTime) !==
    normalizeRescheduleTime(getEventRescheduleTime(event))
  );
};

export const buildTaskRescheduleDueDate = (
  task: Task,
  targetDateKey: string,
  targetTime?: string | null,
) =>
  combineTaskDueDateTime(
    targetDateKey,
    targetTime !== undefined
      ? targetTime
      : extractTaskDueTime(task.due_date),
  );

export const buildCalendarEventReschedulePayload = (
  record: CalendarEventRecord,
  targetDateKey: string,
  targetTime?: string | null,
) =>
  prepareCalendarEventWriteData({
    ...record,
    event_date: targetDateKey,
    ...(targetTime !== undefined ? { event_time: targetTime || null } : {}),
  });

export const getRescheduleSuccessMessage = (
  event: CalendarEvent,
  targetDateKey: string,
  targetTime?: string | null,
) => {
  const label =
    event.kind === "task"
      ? "Task"
      : event.kind === "meeting"
        ? "Meeting"
        : "Event";
  const when = parseDateKey(targetDateKey).toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
  const timeLabel =
    targetTime !== undefined
      ? normalizeRescheduleTime(targetTime)?.slice(0, 5)
      : normalizeRescheduleTime(getEventRescheduleTime(event))?.slice(0, 5);

  return timeLabel ? `${label} moved to ${when} at ${timeLabel}` : `${label} moved to ${when}`;
};
