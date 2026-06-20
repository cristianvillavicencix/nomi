import type { CalendarEvent } from "@/modules/calendar/calendarUtils";
import { formatEventTimeLabel } from "@/modules/calendar/calendarReminderOptions";
import type { OrganizationMember } from "@/components/atomic-crm/types";
import { formatOrganizationMemberName } from "@/modules/billing/billingUtils";
import type { WorkCategory, WorkItem, WorkListGroup } from "@/modules/work/workTypes";
import { toDateKey } from "@/modules/calendar/calendarUtils";

export const WORK_CATEGORY_OPTIONS: Array<{
  value: WorkCategory;
  label: string;
  chipClass: string;
  dotClass: string;
}> = [
  {
    value: "task",
    label: "Task",
    chipClass:
      "border-border bg-muted font-medium text-foreground",
    dotClass: "bg-blue-500",
  },
  {
    value: "meeting",
    label: "Meeting",
    chipClass:
      "border-border bg-muted font-medium text-foreground",
    dotClass: "bg-emerald-500",
  },
  {
    value: "delivery",
    label: "Delivery",
    chipClass:
      "border-border bg-muted font-medium text-foreground",
    dotClass: "bg-violet-500",
  },
  {
    value: "activity",
    label: "Activity",
    chipClass:
      "border-border bg-muted font-medium text-foreground",
    dotClass: "bg-amber-500",
  },
  {
    value: "follow_up",
    label: "Follow up",
    chipClass:
      "border-border bg-muted font-medium text-foreground",
    dotClass: "bg-pink-500",
  },
];

export const getWorkCategoryMeta = (category: WorkCategory) =>
  WORK_CATEGORY_OPTIONS.find((entry) => entry.value === category) ??
  WORK_CATEGORY_OPTIONS[0];

export const getWorkCategoryFromEvent = (
  event: CalendarEvent,
): WorkCategory => {
  if (event.kind === "task" || event.kind === "scheduled_task") return "task";
  if (event.kind === "meeting") return "meeting";
  if (event.kind === "project_delivery") return "delivery";
  if (event.kind === "activity") return "activity";
  if (event.kind === "reminder") return "follow_up";
  return "task";
};

const getAssigneeInitials = (
  event: CalendarEvent,
  member?: OrganizationMember | null,
) => {
  if (event.kind === "task") {
    return null;
  }
  if ("assignedName" in event && event.assignedName) {
    const parts = event.assignedName.trim().split(/\s+/);
    return parts
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase() ?? "")
      .join("");
  }
  if (member) {
    const name = formatOrganizationMemberName(member);
    const parts = name.trim().split(/\s+/);
    return parts
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase() ?? "")
      .join("");
  }
  return null;
};

export const calendarEventToWorkItem = (
  event: CalendarEvent,
  options?: {
    dealName?: string | null;
    member?: OrganizationMember | null;
  },
): WorkItem => {
  const category = getWorkCategoryFromEvent(event);
  const time =
    "time" in event ? formatEventTimeLabel(event.time) || event.time : null;

  let dealId: number | string | null = null;
  let dealName = options?.dealName ?? null;

  if (event.kind === "task") {
    dealId = event.task.deal_id ?? null;
  } else if (event.kind === "project_delivery" || event.kind === "project_start") {
    dealId = event.dealId;
    dealName = event.dealName;
  } else if ("record" in event) {
    dealId = event.record.deal_id ?? null;
  }

  const done =
    event.kind === "task"
      ? Boolean(event.done)
      : "done" in event
        ? Boolean(event.done)
        : false;

  const overdue =
    event.kind === "task" ? Boolean(event.overdue && !event.done) : false;

  return {
    id: event.id,
    category,
    title: event.title,
    date: event.date,
    time,
    dealId,
    dealName,
    assigneeInitials: getAssigneeInitials(event, options?.member),
    done,
    overdue,
    event,
  };
};

export const groupWorkItems = (
  items: WorkItem[],
  todayKey = toDateKey(new Date()),
  options?: { includeDone?: boolean },
): Record<WorkListGroup, WorkItem[]> => {
  const source = options?.includeDone
    ? items
    : items.filter((item) => !item.done);

  if (options?.includeDone) {
    const completed = [...source].sort((left, right) =>
      right.date.localeCompare(left.date),
    );
    return { overdue: [], today: completed, upcoming: [] };
  }

  const overdue: WorkItem[] = [];
  const today: WorkItem[] = [];
  const upcoming: WorkItem[] = [];

  for (const item of source) {
    if (item.date < todayKey) {
      overdue.push(item);
    } else if (item.date === todayKey) {
      today.push(item);
    } else {
      upcoming.push(item);
    }
  }

  const sortByDateTime = (left: WorkItem, right: WorkItem) => {
    const dateDiff = left.date.localeCompare(right.date);
    if (dateDiff !== 0) return dateDiff;
    return (left.time ?? "99:99").localeCompare(right.time ?? "99:99");
  };

  overdue.sort(sortByDateTime);
  today.sort(sortByDateTime);
  upcoming.sort(sortByDateTime);

  return { overdue, today, upcoming };
};

export const filterWorkItemsByCategories = (
  items: WorkItem[],
  categories: WorkCategory[],
) => {
  if (categories.length === 0) return items;
  const allowed = new Set(categories);
  return items.filter((item) => allowed.has(item.category));
};
