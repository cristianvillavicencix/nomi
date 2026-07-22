import type { Task } from "@/components/atomic-crm/types";
import { applyMentionIdsToTaskData } from "@/components/atomic-crm/tasks/taskMentions";
import { syncTaskOwnerFromAssignees } from "@/components/atomic-crm/tasks/normalizeTaskAssignees";
import { combineTaskDueDateTime } from "@/components/atomic-crm/tasks/taskDueDateTime";
import { normalizeReminderOffsetsMinutes } from "@/modules/calendar/calendarReminderWriteUtils";

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
    return (
      new Date(left.due_date).getTime() - new Date(right.due_date).getTime()
    );
  });

const toNumericIdArray = (value: unknown): number[] => {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => Number(item))
    .filter((item) => Number.isFinite(item));
};

const stripVirtualTaskLinkFields = (data: Record<string, unknown>) => {
  const next = { ...data };
  delete next.company_id;
  delete next.additional_contact_ids;
  return next;
};

export const normalizeTaskCreateData = (data: Record<string, unknown>) => {
  const dueTime = data.due_time;
  const withMentions = applyMentionIdsToTaskData(stripVirtualTaskLinkFields(data));
  const { due_time: _formDueTime, ...taskFields } = withMentions as Record<
    string,
    unknown
  > & { due_time?: unknown };
  const assigneePersonIds = toNumericIdArray(taskFields.assignee_person_ids);
  const assigneeSet = new Set(assigneePersonIds);
  const collaboratorPersonIds = toNumericIdArray(
    taskFields.collaborator_person_ids,
  ).filter((id) => !assigneeSet.has(id));
  let mentionedMemberIds = toNumericIdArray(taskFields.mentioned_member_ids);
  const organizationMemberId = Number(taskFields.organization_member_id);

  const rawContactId = taskFields.contact_id;
  const contact_id =
    rawContactId === "" || rawContactId == null ? null : rawContactId;

  if (
    assigneePersonIds.length === 0 &&
    collaboratorPersonIds.length === 0 &&
    mentionedMemberIds.length === 0 &&
    Number.isFinite(organizationMemberId)
  ) {
    mentionedMemberIds = [organizationMemberId];
  }

  return syncTaskOwnerFromAssignees({
    ...taskFields,
    contact_id,
    type: taskFields.type || "none",
    priority: taskFields.priority || "normal",
    internal: Boolean(taskFields.internal),
    assignee_person_ids: assigneePersonIds,
    collaborator_person_ids: collaboratorPersonIds,
    mentioned_member_ids: mentionedMemberIds,
    due_date: combineTaskDueDateTime(taskFields.due_date, dueTime),
    reminder_offsets_minutes: normalizeReminderOffsetsMinutes(
      taskFields.reminder_offsets_minutes,
    ),
  });
};
