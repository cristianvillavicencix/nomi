import { useCallback, useState } from "react";
import type { Identifier } from "ra-core";
import type { TaskStatusFilter } from "@/components/atomic-crm/tasks/taskConstants";
import type { TaskScopeFilter } from "@/components/atomic-crm/tasks/scopedTasks";

const LS_KEY = "nomi-crm:taskPreferences";

export type TaskPreferences = {
  status: TaskStatusFilter;
  scope: TaskScopeFilter;
  typeFilter: string;
  priorityFilter: string;
  projectId: Identifier | null;
};

const DEFAULT_PREFERENCES: TaskPreferences = {
  status: "open",
  scope: "mine",
  typeFilter: "all",
  priorityFilter: "all",
  projectId: null,
};

const readPreferences = (): TaskPreferences => {
  if (typeof window === "undefined") {
    return DEFAULT_PREFERENCES;
  }

  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return DEFAULT_PREFERENCES;

    const parsed = JSON.parse(raw) as Partial<TaskPreferences>;

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
    return DEFAULT_PREFERENCES;
  }
};

const writePreferences = (preferences: TaskPreferences) => {
  if (typeof window === "undefined") return;

  try {
    localStorage.setItem(LS_KEY, JSON.stringify(preferences));
  } catch {
    /* Quota or privacy mode */
  }
};

export const useTaskPreferences = () => {
  const [preferences, setPreferencesState] = useState(readPreferences);

  const setPreferences = useCallback(
    (
      update:
        | Partial<TaskPreferences>
        | ((current: TaskPreferences) => TaskPreferences),
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

export const taskPreferencesHaveActiveFilters = (
  preferences: TaskPreferences,
  { lbsMode }: { lbsMode: boolean },
) =>
  preferences.scope !== "mine" ||
  preferences.priorityFilter !== "all" ||
  preferences.projectId != null ||
  (!lbsMode && preferences.typeFilter !== "all");
