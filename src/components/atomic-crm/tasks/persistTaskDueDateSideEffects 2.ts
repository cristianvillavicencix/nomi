import type { CrmDataProvider } from "@/components/atomic-crm/providers/types";
import type { Identifier } from "ra-core";
import { normalizeTaskDueDateKey } from "@/components/atomic-crm/tasks/taskDueDateUtils";
import {
  getTaskNotificationMemberIds,
  refreshTaskDueDateNotifications,
} from "@/components/atomic-crm/tasks/taskDueDateNotifications";

export const persistTaskDueDateSideEffects = async (
  dataProvider: CrmDataProvider,
  taskId: Identifier,
  task: Record<string, unknown>,
  previousTask: Record<string, unknown>,
) => {
  const memberIds = getTaskNotificationMemberIds(task);
  if (memberIds.length === 0) return;

  await refreshTaskDueDateNotifications(dataProvider, taskId, memberIds);

  try {
    await dataProvider.notifyTaskRescheduled({
      taskId,
      previousDueDate: normalizeTaskDueDateKey(previousTask.due_date) || null,
      appBaseUrl:
        typeof window !== "undefined" ? window.location.origin : undefined,
    });
  } catch (error) {
    console.warn("Task due-date SMS notification failed.", error);
  }
};
