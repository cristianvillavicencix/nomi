import type { WorkCategory } from "@/modules/work/workTypes";
import {
  ALL_WORK_CATEGORIES,
  areAllWorkCategoriesSelected,
} from "@/modules/work/useWorkPreferences";
import { getWorkCategoryMeta } from "@/modules/work/workCategoryUtils";

export type WorkCalendarFilterGroup =
  | "task"
  | "meeting"
  | "scheduled"
  | "project_delivery";

export type WorkCalendarFilterGroupOption = {
  id: WorkCalendarFilterGroup;
  label: string;
  categories: WorkCategory[];
  chipClass: string;
  dotClass: string;
  title: string;
};

const taskMeta = getWorkCategoryMeta("task");
const meetingMeta = getWorkCategoryMeta("meeting");
const activityMeta = getWorkCategoryMeta("activity");
const deliveryMeta = getWorkCategoryMeta("delivery");

export const WORK_CALENDAR_FILTER_GROUPS: WorkCalendarFilterGroupOption[] = [
  {
    id: "task",
    label: "Task",
    categories: ["task"],
    chipClass: taskMeta.chipClass,
    dotClass: taskMeta.dotClass,
    title: "Internal to-do items with due dates",
  },
  {
    id: "meeting",
    label: "Meeting",
    categories: ["meeting"],
    chipClass: meetingMeta.chipClass,
    dotClass: meetingMeta.dotClass,
    title: "Video calls and scheduled meetings",
  },
  {
    id: "scheduled",
    label: "Scheduled",
    categories: ["activity", "follow_up"],
    chipClass: activityMeta.chipClass,
    dotClass: activityMeta.dotClass,
    title: "Calendar events — activities (with contact) and follow-ups",
  },
  {
    id: "project_delivery",
    label: "Project delivery",
    categories: ["delivery"],
    chipClass: deliveryMeta.chipClass,
    dotClass: deliveryMeta.dotClass,
    title: "Automatic milestone from each project's delivery date",
  },
];

export const getWorkCalendarFilterGroup = (id: WorkCalendarFilterGroup) =>
  WORK_CALENDAR_FILTER_GROUPS.find((group) => group.id === id)!;

export const isFilterGroupFullySelected = (
  selected: WorkCategory[],
  group: WorkCalendarFilterGroupOption,
) => group.categories.every((category) => selected.includes(category));

export const isOnlyFilterGroupSelected = (
  selected: WorkCategory[],
  group: WorkCalendarFilterGroupOption,
) =>
  selected.length === group.categories.length &&
  group.categories.every((category) => selected.includes(category));

export const resolveFilterGroupSelection = (
  selected: WorkCategory[],
  groupId: WorkCalendarFilterGroup,
): WorkCategory[] => {
  const group = getWorkCalendarFilterGroup(groupId);
  const allSelected = areAllWorkCategoriesSelected(selected);
  const onlyThis = isOnlyFilterGroupSelected(selected, group);

  if (allSelected) {
    return [...group.categories];
  }
  if (onlyThis) {
    return [...ALL_WORK_CATEGORIES];
  }

  if (isFilterGroupFullySelected(selected, group)) {
    const next = selected.filter(
      (category) => !group.categories.includes(category),
    );
    return next.length > 0 ? next : selected;
  }

  return Array.from(new Set([...selected, ...group.categories]));
};

export const getFilterGroupCount = (
  counts: Partial<Record<WorkCategory, number>>,
  group: WorkCalendarFilterGroupOption,
) =>
  group.categories.reduce((sum, category) => sum + (counts[category] ?? 0), 0);
