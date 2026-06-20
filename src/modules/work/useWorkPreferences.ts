import { useCallback, useState } from "react";
import type { Identifier } from "ra-core";
import type { TaskStatusFilter } from "@/components/atomic-crm/tasks/taskConstants";
import type { TaskScopeFilter } from "@/components/atomic-crm/tasks/scopedTasks";
import type { CalendarView } from "@/modules/calendar/calendarUtils";
import type { WorkCategory, WorkViewMode } from "@/modules/work/workTypes";

const LS_KEY = "nomi-crm:workPreferences";
const LEGACY_TASK_KEY = "nomi-crm:taskPreferences";
const LEGACY_CALENDAR_KEY = "nomi-crm:calendarPreferences";

export type WorkPreferences = {
  viewMode: WorkViewMode;
  status: TaskStatusFilter;
  scope: TaskScopeFilter;
  typeFilter: string;
  priorityFilter: string;
  projectId: Identifier | null;
  categories: WorkCategory[];
  calendarView: CalendarView;
  includeDoneTasks: boolean;
  includeCompletedReminders: boolean;
  showSaturday: boolean;
  showSunday: boolean;
};

const ALL_CATEGORIES: WorkCategory[] = [
  "task",
  "meeting",
  "delivery",
  "activity",
  "follow_up",
];

const DEFAULT_PREFERENCES: WorkPreferences = {
  viewMode: "list",
  status: "open",
  scope: "mine",
  typeFilter: "all",
  priorityFilter: "all",
  projectId: null,
  categories: ALL_CATEGORIES,
  calendarView: "month",
  includeDoneTasks: false,
  includeCompletedReminders: false,
  showSaturday: true,
  showSunday: true,
};

const readLegacyTaskPreferences = (): Partial<WorkPreferences> => {
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem(LEGACY_TASK_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Partial<WorkPreferences>;
    return {
      status: parsed.status === "done" ? "done" : "open",
      scope:
        parsed.scope === "team" ||
        parsed.scope === "my_projects" ||
        parsed.scope === "tagged"
          ? parsed.scope
          : "mine",
      typeFilter: parsed.typeFilter ?? "all",
      priorityFilter: parsed.priorityFilter ?? "all",
      projectId: parsed.projectId ?? null,
    };
  } catch {
    return {};
  }
};

const readLegacyCalendarPreferences = (): Partial<WorkPreferences> => {
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem(LEGACY_CALENDAR_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Partial<WorkPreferences>;
    return {
      calendarView: parsed.calendarView === "week" ? "week" : "month",
      includeDoneTasks: Boolean(parsed.includeDoneTasks),
      includeCompletedReminders: Boolean(parsed.includeCompletedReminders),
      showSaturday: parsed.showSaturday !== false,
      showSunday: parsed.showSunday !== false,
      projectId: parsed.projectId ?? null,
    };
  } catch {
    return {};
  }
};

const readPreferences = (): WorkPreferences => {
  if (typeof window === "undefined") {
    return DEFAULT_PREFERENCES;
  }

  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) {
      return {
        ...DEFAULT_PREFERENCES,
        ...readLegacyTaskPreferences(),
        ...readLegacyCalendarPreferences(),
      };
    }

    const parsed = JSON.parse(raw) as Partial<WorkPreferences>;
    const categories = Array.isArray(parsed.categories)
      ? parsed.categories.filter((value): value is WorkCategory =>
          ALL_CATEGORIES.includes(value as WorkCategory),
        )
      : ALL_CATEGORIES;

    return {
      viewMode:
        parsed.viewMode === "calendar" || parsed.viewMode === "today"
          ? parsed.viewMode
          : "list",
      status: parsed.status === "done" ? "done" : "open",
      scope:
        parsed.scope === "team" ||
        parsed.scope === "my_projects" ||
        parsed.scope === "tagged"
          ? parsed.scope
          : "mine",
      typeFilter: parsed.typeFilter ?? "all",
      priorityFilter: parsed.priorityFilter ?? "all",
      projectId: parsed.projectId ?? null,
      categories: categories.length > 0 ? categories : ALL_CATEGORIES,
      calendarView: parsed.calendarView === "week" ? "week" : "month",
      includeDoneTasks: Boolean(parsed.includeDoneTasks),
      includeCompletedReminders: Boolean(parsed.includeCompletedReminders),
      showSaturday: parsed.showSaturday !== false,
      showSunday: parsed.showSunday !== false,
    };
  } catch {
    return DEFAULT_PREFERENCES;
  }
};

const writePreferences = (preferences: WorkPreferences) => {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(LS_KEY, JSON.stringify(preferences));
  } catch {
    /* Quota or privacy mode */
  }
};

export const workPreferencesHaveActiveFilters = (
  preferences: WorkPreferences,
) =>
  preferences.scope !== "mine" ||
  preferences.priorityFilter !== "all" ||
  preferences.projectId != null ||
  preferences.categories.length !== ALL_CATEGORIES.length;

export const useWorkPreferences = () => {
  const [preferences, setPreferencesState] = useState(readPreferences);

  const setPreferences = useCallback(
    (
      update:
        | Partial<WorkPreferences>
        | ((current: WorkPreferences) => WorkPreferences),
    ) => {
      setPreferencesState((current) => {
        const next =
          typeof update === "function"
            ? update(current)
            : { ...current, ...update };
        writePreferences(next);
        return next;
      });
    },
    [],
  );

  return { preferences, setPreferences };
};

export const toggleWorkCategory = (
  categories: WorkCategory[],
  category: WorkCategory,
) => {
  if (categories.includes(category)) {
    const next = categories.filter((value) => value !== category);
    return next.length > 0 ? next : categories;
  }
  return [...categories, category];
};
