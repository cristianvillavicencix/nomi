import type { CalendarEventRecord, Deal, Task } from "@/components/atomic-crm/types";
import { isTaskOverdue } from "@/components/atomic-crm/tasks/taskStats";
import { getProjectDeliveryDate } from "@/lbs/deals/projectDeliveryDate";
import {
  formatEventTimeLabel,
  formatEventTimeRange,
  formatRemindBeforeLabel,
  getCalendarEntryKind,
  normalizeEventTime,
  type CalendarEntryKind,
} from "@/lbs/calendar/calendarReminderOptions";

export type CalendarView = "month" | "week";

export type CalendarDisplayOptions = {
  showSaturday: boolean;
  showSunday: boolean;
};

export const WEEKDAY_SHORT_LABELS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"] as const;

export const getWeekdayLabel = (date: Date) => WEEKDAY_SHORT_LABELS[date.getDay()];

export const getVisibleWeekdayLabels = (options: CalendarDisplayOptions) =>
  WEEKDAY_SHORT_LABELS.filter((_, index) => {
    if (index === 0 && !options.showSunday) return false;
    if (index === 6 && !options.showSaturday) return false;
    return true;
  });

export const GRID_COLUMN_CLASS: Record<number, string> = {
  5: "grid-cols-5",
  6: "grid-cols-6",
  7: "grid-cols-7",
};

export const isSunday = (date: Date) => date.getDay() === 0;

export const isSaturday = (date: Date) => date.getDay() === 6;

export const isDayVisible = (
  date: Date,
  { showSaturday, showSunday }: CalendarDisplayOptions,
) => {
  if (isSunday(date) && !showSunday) return false;
  if (isSaturday(date) && !showSaturday) return false;
  return true;
};

export const getVisibleColumnCount = (options: CalendarDisplayOptions) =>
  7 - (options.showSunday ? 0 : 1) - (options.showSaturday ? 0 : 1);

export const getWeekendCellClassName = (date: Date) => {
  if (isSunday(date)) {
    return "bg-sky-50/90 dark:bg-sky-950/25";
  }
  if (isSaturday(date)) {
    return "bg-violet-50/80 dark:bg-violet-950/20";
  }
  return "";
};

export type CalendarEvent =
  | {
      kind: "task";
      id: string;
      date: string;
      title: string;
      task: Task;
      overdue: boolean;
      done: boolean;
    }
  | {
      kind: "project_delivery";
      id: string;
      date: string;
      title: string;
      dealId: Deal["id"];
      dealName: string;
    }
  | {
      kind: "project_start";
      id: string;
      date: string;
      title: string;
      dealId: Deal["id"];
      dealName: string;
    }
  | {
      kind: CalendarEntryKind;
      id: string;
      date: string;
      time?: string | null;
      title: string;
      record: CalendarEventRecord;
      done: boolean;
      assignedName?: string | null;
      contactName?: string | null;
    };

export const toDateKey = (date: Date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

export const parseDateKey = (value: string) => {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, month - 1, day);
};

export const startOfDay = (date: Date) =>
  new Date(date.getFullYear(), date.getMonth(), date.getDate());

export const addDays = (date: Date, amount: number) => {
  const next = new Date(date);
  next.setDate(next.getDate() + amount);
  return startOfDay(next);
};

export const addMonths = (date: Date, amount: number) =>
  new Date(date.getFullYear(), date.getMonth() + amount, 1);

export const startOfMonth = (date: Date) =>
  new Date(date.getFullYear(), date.getMonth(), 1);

export const endOfMonth = (date: Date) =>
  new Date(date.getFullYear(), date.getMonth() + 1, 0);

export const startOfWeek = (date: Date) => {
  const start = startOfDay(date);
  start.setDate(start.getDate() - start.getDay());
  return start;
};

export const endOfWeek = (date: Date) => addDays(startOfWeek(date), 6);

export const isSameDay = (left: Date, right: Date) =>
  toDateKey(left) === toDateKey(right);

export const isSameMonth = (left: Date, right: Date) =>
  left.getFullYear() === right.getFullYear() &&
  left.getMonth() === right.getMonth();

export const formatMonthLabel = (date: Date) =>
  date.toLocaleDateString(undefined, { month: "short", year: "numeric" });

export const formatWeekLabel = (date: Date) => {
  const start = startOfWeek(date);
  const end = endOfWeek(date);
  const sameMonth =
    start.getMonth() === end.getMonth() && start.getFullYear() === end.getFullYear();
  const sameYear = start.getFullYear() === end.getFullYear();

  if (sameMonth) {
    const month = start.toLocaleDateString(undefined, { month: "short" });
    return `${month} ${start.getDate()}–${end.getDate()}, ${start.getFullYear()}`;
  }

  if (sameYear) {
    const startLabel = start.toLocaleDateString(undefined, { month: "short", day: "numeric" });
    const endLabel = end.toLocaleDateString(undefined, { month: "short", day: "numeric" });
    return `${startLabel}–${endLabel}, ${start.getFullYear()}`;
  }

  const startLabel = start.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "2-digit",
  });
  const endLabel = end.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "2-digit",
  });
  return `${startLabel}–${endLabel}`;
};

export const formatDayLabel = (dateKey: string) =>
  parseDateKey(dateKey).toLocaleDateString(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });

export const getMonthGridDays = (anchor: Date) => {
  const monthStart = startOfMonth(anchor);
  const monthEnd = endOfMonth(anchor);
  const gridStart = startOfWeek(monthStart);
  const gridEnd = addDays(startOfWeek(monthEnd), 6);
  const days: Date[] = [];
  let cursor = gridStart;
  while (cursor <= gridEnd) {
    days.push(cursor);
    cursor = addDays(cursor, 1);
  }
  return days;
};

export const getWeekDays = (anchor: Date) =>
  Array.from({ length: 7 }, (_, index) => addDays(startOfWeek(anchor), index));

export const normalizeDateOnly = (value?: string | null) => {
  if (!value?.trim()) return null;
  return value.length >= 10 ? value.slice(0, 10) : null;
};

export const buildTaskCalendarEvent = (task: Task): CalendarEvent | null => {
  const date = normalizeDateOnly(task.due_date);
  if (!date) return null;

  return {
    kind: "task",
    id: `task:${task.id}`,
    date,
    title: task.text?.trim() || "Task",
    task,
    overdue: isTaskOverdue(task),
    done: Boolean(task.done_date),
  };
};

export const buildDealCalendarEvents = (deal: Deal): CalendarEvent[] => {
  const events: CalendarEvent[] = [];
  const dealName = deal.name?.trim() || `Project #${deal.id}`;

  const deliveryDate = normalizeDateOnly(getProjectDeliveryDate(deal));
  if (deliveryDate) {
    events.push({
      kind: "project_delivery",
      id: `delivery:${deal.id}`,
      date: deliveryDate,
      title: dealName,
      dealId: deal.id,
      dealName,
    });
  }

  const startDate = normalizeDateOnly(deal.start_date);
  if (startDate) {
    events.push({
      kind: "project_start",
      id: `start:${deal.id}`,
      date: startDate,
      title: dealName,
      dealId: deal.id,
      dealName,
    });
  }

  return events;
};

export const buildCalendarEntryEvent = (
  record: CalendarEventRecord,
  names?: { assignedName?: string | null; contactName?: string | null },
): CalendarEvent | null => {
  const date = normalizeDateOnly(record.event_date);
  if (!date) return null;

  const kind = getCalendarEntryKind(record);

  return {
    kind,
    id: `${kind}:${record.id}`,
    date,
    time: normalizeEventTime(record.event_time),
    title: record.title?.trim() || "Reminder",
    record,
    done: Boolean(record.completed_at),
    assignedName: names?.assignedName ?? null,
    contactName: names?.contactName ?? null,
  };
};

export const groupEventsByDate = (events: CalendarEvent[]) => {
  const grouped: Record<string, CalendarEvent[]> = {};
  events.forEach((event) => {
    grouped[event.date] = grouped[event.date] ? [...grouped[event.date], event] : [event];
  });
  Object.values(grouped).forEach((entries) => {
    entries.sort((left, right) => {
      const kindOrder = (event: CalendarEvent) => {
        if (event.kind === "task" && event.overdue && !event.done) return 0;
        if (event.kind === "task") return 1;
        if (event.kind === "activity") return 2;
        if (event.kind === "meeting") return 2;
        if (event.kind === "scheduled_task") return 3;
        if (event.kind === "reminder") return 4;
        if (event.kind === "project_delivery") return 5;
        return 6;
      };
      const orderDiff = kindOrder(left) - kindOrder(right);
      if (orderDiff !== 0) return orderDiff;
      const leftTime = "time" in left ? left.time ?? "99:99" : "99:99";
      const rightTime = "time" in right ? right.time ?? "99:99" : "99:99";
      const timeDiff = leftTime.localeCompare(rightTime);
      if (timeDiff !== 0) return timeDiff;
      return left.title.localeCompare(right.title);
    });
  });
  return grouped;
};

export const getVisibleRange = (anchor: Date, view: CalendarView) => {
  if (view === "week") {
    const start = startOfWeek(anchor);
    const end = endOfWeek(anchor);
    return { start: toDateKey(start), end: toDateKey(end) };
  }

  const days = getMonthGridDays(anchor);
  return {
    start: toDateKey(days[0]),
    end: toDateKey(days[days.length - 1]),
  };
};

export const getEventClassName = (event: CalendarEvent) => {
  if (event.kind === "task") {
    if (event.done) {
      return "border-transparent bg-muted text-muted-foreground line-through";
    }
    if (event.overdue) {
      return "border-red-200 bg-red-50 text-red-900 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-100";
    }
    return "border-blue-200 bg-blue-50 text-blue-900 dark:border-blue-900/50 dark:bg-blue-950/40 dark:text-blue-100";
  }
  if (event.kind === "project_delivery") {
    return "border-violet-200 bg-violet-50 text-violet-900 dark:border-violet-900/50 dark:bg-violet-950/40 dark:text-violet-100";
  }
  if (event.kind === "activity") {
    if (event.done) {
      return "border-transparent bg-muted text-muted-foreground line-through";
    }
    return "border-amber-200 bg-amber-50 text-amber-950 dark:border-amber-900/50 dark:bg-amber-950/40 dark:text-amber-100";
  }
  if (event.kind === "meeting") {
    if (event.done) {
      return "border-transparent bg-muted text-muted-foreground line-through";
    }
    return "border-emerald-200 bg-emerald-50 text-emerald-950 dark:border-emerald-900/50 dark:bg-emerald-950/40 dark:text-emerald-100";
  }
  if (event.kind === "scheduled_task") {
    if (event.done) {
      return "border-transparent bg-muted text-muted-foreground line-through";
    }
    return "border-sky-200 bg-sky-50 text-sky-950 dark:border-sky-900/50 dark:bg-sky-950/40 dark:text-sky-100";
  }
  if (event.kind === "reminder") {
    if (event.done) {
      return "border-transparent bg-muted text-muted-foreground line-through";
    }
    return "border-yellow-200 bg-yellow-50 text-yellow-950 dark:border-yellow-900/50 dark:bg-yellow-950/40 dark:text-yellow-100";
  }
  return "border-emerald-200 bg-emerald-50 text-emerald-900 dark:border-emerald-900/50 dark:bg-emerald-950/40 dark:text-emerald-100";
};

export const getEventLabel = (event: CalendarEvent) => {
  if (event.kind === "task") return event.title;
  if (
    event.kind === "activity" ||
    event.kind === "meeting" ||
    event.kind === "scheduled_task" ||
    event.kind === "reminder"
  ) {
    const timeLabel = formatEventTimeLabel(event.time);
    const timeRangeLabel =
      "record" in event
        ? formatEventTimeRange(event.record.event_time, event.record.duration_minutes)
        : null;
    const displayTime = timeRangeLabel ?? timeLabel;
    const prefix =
      event.kind === "meeting"
        ? "Meeting"
        : event.kind === "activity"
          ? "Activity"
          : event.kind === "scheduled_task"
            ? "Task"
            : "Reminder";
    const linkedName = event.contactName || event.assignedName;
    const titleParts = [prefix, displayTime, event.title].filter(Boolean);
    const base = titleParts.join(" · ");
    return linkedName ? `${base} · ${linkedName}` : base;
  }
  if (event.kind === "project_delivery") return `Delivery · ${event.title}`;
  return `Start · ${event.title}`;
};

export const getCalendarEntryMeta = (event: Extract<
  CalendarEvent,
  { kind: "activity" | "meeting" | "scheduled_task" | "reminder" }
>) => {
  const timeLabel = formatEventTimeLabel(event.time);
  const remindLabel = formatRemindBeforeLabel(event.record.remind_before_minutes);
  return { timeLabel, remindLabel };
};

export type CalendarEntryEvent = Extract<
  CalendarEvent,
  { kind: "activity" | "meeting" | "scheduled_task" | "reminder" }
>;

export const isCalendarEntryEvent = (
  event: CalendarEvent,
): event is CalendarEntryEvent =>
  event.kind === "activity" ||
  event.kind === "meeting" ||
  event.kind === "scheduled_task" ||
  event.kind === "reminder";
