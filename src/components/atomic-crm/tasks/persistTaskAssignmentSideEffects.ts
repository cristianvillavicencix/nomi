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
    await createTaskTagNotifications(
      dataProvider,
      taskId,
      payload.assignee_person_ids,
      payload.collaborator_person_ids,
      payload.mentioned_member_ids,
    );
  } catch (error) {
    console.warn("Task assignment sync failed. Apply DB migrations.", error);
  }
};
