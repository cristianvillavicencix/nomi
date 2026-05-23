import type { Identifier } from "ra-core";
import type { Task, TaskParticipant } from "@/components/atomic-crm/types";
import { findCurrentUserParticipant } from "@/components/atomic-crm/tasks/taskParticipants";

export const groupTaskParticipantsByTaskId = (
  participants: TaskParticipant[],
): Record<string, TaskParticipant[]> => {
  const grouped: Record<string, TaskParticipant[]> = {};
  participants.forEach((participant) => {
    const key = String(participant.task_id);
    grouped[key] = grouped[key]
      ? [...grouped[key], participant]
      : [participant];
  });
  return grouped;
};

export const taskUsesParticipantCompletion = (
  participants: TaskParticipant[],
) => participants.length > 0;

export const isTaskOpenForUser = (
  task: Task,
  participants: TaskParticipant[],
  organizationMemberId: Identifier,
  personId?: Identifier | null,
) => {
  if (!taskUsesParticipantCompletion(participants)) {
    return task.done_date == null;
  }

  const userParticipant = findCurrentUserParticipant(
    participants,
    personId,
    organizationMemberId,
  );
  if (!userParticipant) {
    return task.done_date == null;
  }

  return userParticipant.completed_at == null;
};

export const isTaskDoneForUser = (
  task: Task,
  participants: TaskParticipant[],
  organizationMemberId: Identifier,
  personId?: Identifier | null,
) => {
  if (!taskUsesParticipantCompletion(participants)) {
    return task.done_date != null;
  }

  const userParticipant = findCurrentUserParticipant(
    participants,
    personId,
    organizationMemberId,
  );
  if (userParticipant) {
    return userParticipant.completed_at != null;
  }

  return task.done_date != null;
};

export const scopeUsesUserCompletionFilter = (scope: string) =>
  scope === "mine" || scope === "my_projects";
