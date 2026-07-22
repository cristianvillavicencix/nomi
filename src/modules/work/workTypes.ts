import type { CalendarEvent } from "@/modules/calendar/calendarUtils";
import type { Task } from "@/components/atomic-crm/types";

export type WorkViewMode = "list" | "calendar" | "today";

/** Main work calendar area: grid (month/week) or row list for the selected period. */
export type WorkCalendarDisplay = "calendar" | "list";

export type WorkCategory =
  | "task"
  | "meeting"
  | "delivery"
  | "activity"
  | "follow_up";

export type WorkItem = {
  id: string;
  category: WorkCategory;
  title: string;
  date: string;
  time?: string | null;
  dealId?: number | string | null;
  dealName?: string | null;
  assigneeInitials?: string | null;
  done: boolean;
  overdue: boolean;
  event: CalendarEvent;
};

export type WorkListGroup = "overdue" | "today" | "upcoming";

export const WORK_LIST_GROUP_LABELS: Record<
  WorkListGroup,
  (count: number) => string
> = {
  overdue: (count) => `Overdue ${count}`,
  today: (count) => {
    const label = new Date().toLocaleDateString("en-US", {
      weekday: "short",
      day: "numeric",
      month: "short",
    });
    return `Today · ${label} ${count}`;
  },
  upcoming: (count) => `Upcoming ${count}`,
};
