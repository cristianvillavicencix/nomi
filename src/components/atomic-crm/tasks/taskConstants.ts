import type { Task } from "@/components/atomic-crm/types";
import { applyMentionIdsToTaskData } from "@/components/atomic-crm/tasks/taskMentions";

export const TASK_PRIORITIES = [
  { value: "low", label: "Low" },
  { value: "normal", label: "Normal" },
  { value: "high", label: "High" },
] as const;

export type TaskPriority = (typeof TASK_PRIORITIES)[number]["value"];

export const TASK_STATUS_FILTERS = {
  open: { "done_date@is": null },
  done: { "done_date@not.is": null },
} as const;

export type TaskStatusFilter = keyof typeof TASK_STATUS_FILTERS;

export const getTaskPriorityLabel = (priority?: string | null) =>
  TASK_PRIORITIES.find((entry) => entry.value === priority)?.label ?? "Normal";

export const getTaskPriorityClassName = (priority?: string | null) => {
  switch (priority) {
    case "high":
      return "border-red-200 bg-red-50 text-red-900 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-100";
    case "low":
      return "border-slate-200 bg-slate-50 text-slate-700 dark:border-slate-800 dark:bg-slate-950/30 dark:text-slate-200";
    default:
      return "border-transparent bg-muted text-muted-foreground";
  }
};

const priorityRank: Record<string, number> = { high: 0, normal: 1, low: 2 };

export const sortTasksByPriorityAndDue = (tasks: Task[]) =>
  [...tasks].sort((left, right) => {
    const priorityDiff =
      (priorityRank[left.priority ?? "normal"] ?? 1) -
      (priorityRank[right.priority ?? "normal"] ?? 1);
    if (priorityDiff !== 0) return priorityDiff;
    return new Date(left.due_date).getTime() - new Date(right.due_date).getTime();
  });

const toNumericIdArray = (value: unknown): number[] => {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => Number(item))
    .filter((item) => Number.isFinite(item));
};

export const normalizeTaskCreateData = (data: Record<string, unknown>) => {
  const dueDate = new Date(String(data.due_date));
  dueDate.setHours(0, 0, 0, 0);
  const withMentions = applyMentionIdsToTaskData(data);
  const assigneePersonIds = toNumericIdArray(withMentions.assignee_person_ids);
  const assigneeSet = new Set(assigneePersonIds);
  const collaboratorPersonIds = toNumericIdArray(
    withMentions.collaborator_person_ids,
  ).filter((id) => !assigneeSet.has(id));
  const mentionedMemberIds = toNumericIdArray(withMentions.mentioned_member_ids);

  return {
    ...withMentions,
    type: withMentions.type || "none",
    priority: withMentions.priority || "normal",
    internal: Boolean(withMentions.internal),
    assignee_person_ids: assigneePersonIds,
    collaborator_person_ids: collaboratorPersonIds,
    mentioned_member_ids: mentionedMemberIds,
    due_date: dueDate.toISOString(),
  };
};
