import type { CalendarEvent } from "@/modules/calendar/calendarUtils";
import { isCalendarEntryEvent } from "@/modules/calendar/calendarUtils";

const ASSIGNee_COLOR_CLASSES = [
  "border-blue-300 bg-blue-50 text-blue-900 dark:border-blue-800 dark:bg-blue-950/50 dark:text-blue-100",
  "border-emerald-300 bg-emerald-50 text-emerald-900 dark:border-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-100",
  "border-violet-300 bg-violet-50 text-violet-900 dark:border-violet-800 dark:bg-violet-950/50 dark:text-violet-100",
  "border-amber-300 bg-amber-50 text-amber-900 dark:border-amber-800 dark:bg-amber-950/50 dark:text-amber-100",
  "border-pink-300 bg-pink-50 text-pink-900 dark:border-pink-800 dark:bg-pink-950/50 dark:text-pink-100",
  "border-cyan-300 bg-cyan-50 text-cyan-900 dark:border-cyan-800 dark:bg-cyan-950/50 dark:text-cyan-100",
  "border-orange-300 bg-orange-50 text-orange-900 dark:border-orange-800 dark:bg-orange-950/50 dark:text-orange-100",
  "border-indigo-300 bg-indigo-50 text-indigo-900 dark:border-indigo-800 dark:bg-indigo-950/50 dark:text-indigo-100",
  "border-teal-300 bg-teal-50 text-teal-900 dark:border-teal-800 dark:bg-teal-950/50 dark:text-teal-100",
  "border-rose-300 bg-rose-50 text-rose-900 dark:border-rose-800 dark:bg-rose-950/50 dark:text-rose-100",
  "border-lime-300 bg-lime-50 text-lime-900 dark:border-lime-800 dark:bg-lime-950/50 dark:text-lime-100",
  "border-sky-300 bg-sky-50 text-sky-900 dark:border-sky-800 dark:bg-sky-950/50 dark:text-sky-100",
] as const;

const hashMemberId = (memberId: string | number) => {
  const key = String(memberId);
  let hash = 0;
  for (let index = 0; index < key.length; index += 1) {
    hash = (hash * 31 + key.charCodeAt(index)) >>> 0;
  }
  return hash;
};

export const getAssigneeColorClassName = (
  memberId: string | number | null | undefined,
) => {
  if (memberId == null || memberId === "") return null;
  const index = hashMemberId(memberId) % ASSIGNee_COLOR_CLASSES.length;
  return ASSIGNee_COLOR_CLASSES[index];
};

export const getCalendarEventAssigneeColorClassName = (event: CalendarEvent) => {
  if (event.kind === "task") {
    const assigneeId =
      event.task.assignee_person_ids?.[0] ?? event.task.organization_member_id;
    return getAssigneeColorClassName(assigneeId ?? null);
  }
  if (isCalendarEntryEvent(event)) {
    const assigneeId =
      event.record.assignee_member_ids?.[0] ??
      event.record.organization_member_id;
    return getAssigneeColorClassName(assigneeId ?? null);
  }
  return null;
};
