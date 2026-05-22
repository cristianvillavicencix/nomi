import type { DataProvider, Identifier } from "ra-core";
import {
  createTaskTagNotifications,
  stripTaskAssignmentFields,
  syncTaskAssignees,
} from "@/components/atomic-crm/tasks/taskAssignments";
import { syncTaskParticipants } from "@/components/atomic-crm/tasks/taskParticipants";
import { normalizeTaskCreateData } from "@/components/atomic-crm/tasks/taskConstants";
import {
  extractMentionMemberIds,
  extractMentionPersonIds,
} from "@/components/atomic-crm/tasks/taskMentions";

export type TaskAssignmentPayload = {
  assignee_person_ids: number[];
  collaborator_person_ids: number[];
  mentioned_member_ids: number[];
};

export const TASK_ASSIGNMENT_FIELD_KEYS = [
  "text",
  "assignee_person_ids",
  "collaborator_person_ids",
  "mentioned_member_ids",
  "organization_member_id",
] as const;

export const taskAssignmentFieldsChanged = (
  previous: Record<string, unknown> | undefined,
  current: Record<string, unknown>,
) => {
  if (!previous) return true;

  return TASK_ASSIGNMENT_FIELD_KEYS.some(
    (key) =>
      JSON.stringify(previous[key] ?? null) !==
      JSON.stringify(current[key] ?? null),
  );
};

export const getTaskAssignmentPayload = (
  task: Record<string, unknown>,
): TaskAssignmentPayload => {
  const mentionPersonIds = extractMentionPersonIds(String(task.text ?? ""));
  const mentionMemberIds = extractMentionMemberIds(String(task.text ?? ""));

  return {
    assignee_person_ids:
      mentionPersonIds.length > 0
        ? mentionPersonIds
        : Array.isArray(task.assignee_person_ids)
          ? task.assignee_person_ids.map(Number).filter(Number.isFinite)
          : [],
    collaborator_person_ids: Array.isArray(task.collaborator_person_ids)
      ? task.collaborator_person_ids.map(Number).filter(Number.isFinite)
      : [],
    mentioned_member_ids:
      mentionMemberIds.length > 0
        ? mentionMemberIds
        : Array.isArray(task.mentioned_member_ids)
          ? task.mentioned_member_ids.map(Number).filter(Number.isFinite)
          : [],
  };
};

/** Keep @ mention data in `text`; assignment arrays are persisted in a follow-up step. */
export const prepareTaskWriteData = (data: Record<string, unknown>) => {
  const normalized = normalizeTaskCreateData(data);
  return stripTaskAssignmentFields(normalized);
};

export const persistTaskAssignmentSideEffects = async (
  dataProvider: DataProvider,
  taskId: Identifier,
  task: Record<string, unknown>,
  previousData?: Record<string, unknown>,
) => {
  if (
    previousData &&
    !taskAssignmentFieldsChanged(previousData, task)
  ) {
    return;
  }

  const payload = getTaskAssignmentPayload(task);

  try {
    await dataProvider.update("tasks", {
      id: taskId,
      data: {
        assignee_person_ids: payload.assignee_person_ids,
        collaborator_person_ids: payload.collaborator_person_ids,
        mentioned_member_ids: payload.mentioned_member_ids,
      },
      previousData: previousData ?? task,
      meta: { skipTaskAssignmentSideEffects: true },
    });
  } catch (error) {
    console.warn("Task assignment columns are not available yet. Apply DB migrations.", error);
  }

  try {
    await syncTaskAssignees(
      dataProvider,
      taskId,
      payload.assignee_person_ids,
      payload.collaborator_person_ids,
    );
    await syncTaskParticipants(
      dataProvider,
      taskId,
      payload,
      task.organization_member_id as Identifier | null | undefined,
    );
  } catch (error) {
    console.warn("Task assignment sync failed. Apply DB migrations.", error);
  }

  try {
    await createTaskTagNotifications(
      dataProvider,
      taskId,
      payload.assignee_person_ids,
      payload.collaborator_person_ids,
      payload.mentioned_member_ids,
    );
  } catch (error) {
    console.warn("Task tag notifications failed.", error);
  }
};
