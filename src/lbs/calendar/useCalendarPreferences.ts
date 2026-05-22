import { useCallback, useState } from "react";
import type { Identifier } from "ra-core";
import type { CalendarView } from "@/lbs/calendar/calendarUtils";

const LS_KEY = "nomi-crm:calendarPreferences";

export type CalendarPreferences = {
  view: CalendarView;
  includeDoneTasks: boolean;
  includeCompletedReminders: boolean;
  showSaturday: boolean;
  showSunday: boolean;
  projectId: Identifier | null;
};

const DEFAULT_PREFERENCES: CalendarPreferences = {
  view: "month",
  includeDoneTasks: false,
  includeCompletedReminders: false,
  showSaturday: true,
  showSunday: true,
  projectId: null,
};

const readPreferences = (): CalendarPreferences => {
  if (typeof window === "undefined") {
    return DEFAULT_PREFERENCES;
  }

  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return DEFAULT_PREFERENCES;

    const parsed = JSON.parse(raw) as Partial<CalendarPreferences>;

    return {
      view: parsed.view === "week" ? "week" : "month",
      includeDoneTasks: Boolean(parsed.includeDoneTasks),
      includeCompletedReminders: Boolean(parsed.includeCompletedReminders),
      showSaturday: parsed.showSaturday !== false,
      showSunday: parsed.showSunday !== false,
      projectId: parsed.projectId ?? null,
    };
  } catch {
    return DEFAULT_PREFERENCES;
  }
};

const writePreferences = (preferences: CalendarPreferences) => {
  if (typeof window === "undefined") return;

  try {
    localStorage.setItem(LS_KEY, JSON.stringify(preferences));
  } catch {
    /* Quota or privacy mode */
  }
};

export const useCalendarPreferences = () => {
  const [preferences, setPreferencesState] = useState(readPreferences);

  const setPreferences = useCallback(
    (
      update:
        | Partial<CalendarPreferences>
        | ((current: CalendarPreferences) => CalendarPreferences),
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
