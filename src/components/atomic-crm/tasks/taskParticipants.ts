import type { DataProvider, Identifier } from "ra-core";
import type { Task, TaskParticipant } from "@/components/atomic-crm/types";
import type { TaskAssignmentPayload } from "@/components/atomic-crm/tasks/persistTaskAssignmentSideEffects";

export type DesiredTaskParticipant = {
  organization_member_id: Identifier;
};

const participantKey = (participant: {
  organization_member_id?: Identifier | null;
}) => `member:${participant.organization_member_id}`;

export const buildDesiredTaskParticipants = (
  payload: TaskAssignmentPayload,
  ownerOrganizationMemberId?: Identifier | null,
): DesiredTaskParticipant[] => {
  const memberIds = Array.from(
    new Set(
      [
        ...payload.assignee_person_ids,
        ...payload.collaborator_person_ids,
        ...payload.mentioned_member_ids,
        ...(ownerOrganizationMemberId != null
          ? [Number(ownerOrganizationMemberId)]
          : []),
      ].filter(Number.isFinite),
    ),
  );

  return memberIds.map((memberId) => ({
    organization_member_id: memberId,
  }));
};

export const getTaskParticipantCount = (task: Task) => {
  const memberIds = new Set<string>();
  (task.assignee_person_ids ?? []).forEach((id) => memberIds.add(String(id)));
  (task.collaborator_person_ids ?? []).forEach((id) =>
    memberIds.add(String(id)),
  );
  (task.mentioned_member_ids ?? []).forEach((id) => memberIds.add(String(id)));
  return memberIds.size;
};

export const taskRequiresAllParticipantsComplete = (task: Task) =>
  getTaskParticipantCount(task) > 1;

export const isParticipantComplete = (
  participants: TaskParticipant[],
  target: { memberId?: Identifier },
) =>
  participants.some(
    (entry) =>
      Boolean(entry.completed_at) &&
      target.memberId != null &&
      entry.organization_member_id != null &&
      String(entry.organization_member_id) === String(target.memberId),
  );

export const syncTaskParticipants = async (
  dataProvider: DataProvider,
  taskId: Identifier,
  payload: TaskAssignmentPayload,
  ownerOrganizationMemberId?: Identifier | null,
) => {
  const desired = buildDesiredTaskParticipants(
    payload,
    ownerOrganizationMemberId,
  );
  const desiredKeys = new Set(desired.map((entry) => participantKey(entry)));

  const { data: existing = [] } = await dataProvider.getList<TaskParticipant>(
    "task_participants",
    {
      filter: { "task_id@eq": taskId },
      pagination: { page: 1, perPage: 500 },
      sort: { field: "id", order: "ASC" },
    },
  );

  const existingByKey = new Map(
    existing.map((entry) => [participantKey(entry), entry]),
  );

  await Promise.all(
    existing
      .filter((entry) => !desiredKeys.has(participantKey(entry)))
      .map((entry) =>
        dataProvider.delete("task_participants", {
          id: entry.id,
          previousData: entry,
        }),
      ),
  );

  await Promise.all(
    desired
      .filter((entry) => !existingByKey.has(participantKey(entry)))
      .map((entry) =>
        dataProvider.create("task_participants", {
          data: {
            task_id: taskId,
            person_id: null,
            organization_member_id: entry.organization_member_id,
            completed_at: null,
          },
        }),
      ),
  );
};

export const recomputeTaskDoneDate = async (
  dataProvider: DataProvider,
  task: Task,
  participants: TaskParticipant[],
) => {
  if (participants.length === 0) return task;

  const allComplete =
    participants.length > 0 &&
    participants.every((entry) => Boolean(entry.completed_at));
  const latestCompletion = participants
    .map((entry) => entry.completed_at)
    .filter(Boolean)
    .sort()
    .at(-1);
  const nextDoneDate = allComplete
    ? (latestCompletion ?? task.done_date ?? new Date().toISOString())
    : null;

  if (Boolean(task.done_date) === Boolean(nextDoneDate)) {
    return task;
  }

  const { data: updated } = await dataProvider.update<Task>("tasks", {
    id: task.id,
    data: { done_date: nextDoneDate },
    previousData: task,
    meta: { skipTaskAssignmentSideEffects: true },
  });

  return updated;
};

export const findCurrentUserParticipant = (
  participants: TaskParticipant[],
  organizationMemberId?: Identifier | null,
) =>
  participants.find(
    (entry) =>
      organizationMemberId != null &&
      entry.organization_member_id != null &&
      String(entry.organization_member_id) === String(organizationMemberId),
  );

export const toggleTaskParticipantCompletion = async (
  dataProvider: DataProvider,
  task: Task,
  participant: TaskParticipant,
  participants: TaskParticipant[],
) => {
  const nextCompletedAt = participant.completed_at
    ? null
    : new Date().toISOString();

  await dataProvider.update("task_participants", {
    id: participant.id,
    data: { completed_at: nextCompletedAt },
    previousData: participant,
  });

  const nextParticipants = participants.map((entry) =>
    String(entry.id) === String(participant.id)
      ? { ...entry, completed_at: nextCompletedAt }
      : entry,
  );

  return recomputeTaskDoneDate(dataProvider, task, nextParticipants);
};
