import type { CalendarEvent } from "@/modules/calendar/calendarUtils";
import type { WorkCategory } from "@/modules/work/workTypes";

/** Categories shown in Add / Create calendar forms (simplified). */
export type WorkCreateCategory = "task" | "meeting" | "scheduled_event";

export const WORK_CREATE_CATEGORY_OPTIONS: Array<{
  value: WorkCreateCategory;
  label: string;
  chipClass: string;
}> = [
  {
    value: "task",
    label: "Task",
    chipClass:
      "border-blue-300 bg-blue-50 font-medium text-blue-900 dark:border-blue-800 dark:bg-blue-950/50 dark:text-blue-100",
  },
  {
    value: "meeting",
    label: "Meeting",
    chipClass:
      "border-emerald-300 bg-emerald-50 font-medium text-emerald-900 dark:border-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-100",
  },
  {
    value: "scheduled_event",
    label: "Scheduled event",
    chipClass:
      "border-amber-300 bg-amber-50 font-medium text-amber-900 dark:border-amber-800 dark:bg-amber-950/50 dark:text-amber-100",
  },
];

export const isTaskCreateCategory = (category: WorkCreateCategory) =>
  category === "task";

export const isMeetingCreateCategory = (category: WorkCreateCategory) =>
  category === "meeting";

export const isScheduledEventCreateCategory = (category: WorkCreateCategory) =>
  category === "scheduled_event";

/** Map calendar filter categories to the simplified create form. */
export const workCategoryToCreateCategory = (
  category: WorkCategory,
): WorkCreateCategory => {
  if (category === "meeting") return "meeting";
  if (category === "task") return "task";
  return "scheduled_event";
};

export const calendarEventToCreateCategory = (
  event: CalendarEvent,
): WorkCreateCategory => {
  if (event.kind === "task") return "task";
  if (event.kind === "meeting") return "meeting";
  return "scheduled_event";
};
