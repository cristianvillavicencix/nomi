import { formatDistanceStrict } from "date-fns";
import type { Task, TaskParticipant } from "@/components/atomic-crm/types";

export const getTaskCreatedAt = (task: Task) =>
  task.created_at ?? task.due_date;

export const formatTaskDuration = (
  start: string | Date,
  end: string | Date = new Date(),
) => formatDistanceStrict(new Date(start), new Date(end));

export const getOpenTaskAgeLabel = (task: Task) =>
  `${formatTaskDuration(getTaskCreatedAt(task))} open`;

export const getUserCompletionDurationLabel = (
  task: Task,
  participant?: TaskParticipant | null,
) => {
  if (!participant?.completed_at) return null;
  return formatTaskDuration(getTaskCreatedAt(task), participant.completed_at);
};
