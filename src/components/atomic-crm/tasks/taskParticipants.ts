import type { DataProvider, Identifier } from "ra-core";
import type { Task, TaskParticipant } from "@/components/atomic-crm/types";
import type { TaskAssignmentPayload } from "@/components/atomic-crm/tasks/persistTaskAssignmentSideEffects";

export type DesiredTaskParticipant =
  | { person_id: Identifier; organization_member_id?: null }
  | { person_id?: null; organization_member_id: Identifier };

const participantKey = (participant: {
  person_id?: Identifier | null;
  organization_member_id?: Identifier | null;
}) =>
  participant.person_id != null
    ? `person:${participant.person_id}`
    : `member:${participant.organization_member_id}`;

export const buildDesiredTaskParticipants = (
  payload: TaskAssignmentPayload,
  ownerOrganizationMemberId?: Identifier | null,
): DesiredTaskParticipant[] => {
  const personIds = Array.from(
    new Set([
      ...payload.assignee_person_ids,
      ...payload.collaborator_person_ids,
    ]),
  );
  const memberIds = Array.from(
    new Set(
      [
        ...payload.mentioned_member_ids.filter((memberId) =>
          Number.isFinite(Number(memberId)),
        ),
        ...(ownerOrganizationMemberId != null
          ? [Number(ownerOrganizationMemberId)]
          : []),
      ].filter(Number.isFinite),
    ),
  );

  const participants: DesiredTaskParticipant[] = personIds.map((personId) => ({
    person_id: personId,
  }));

  memberIds.forEach((memberId) => {
    participants.push({ organization_member_id: memberId });
  });

  return participants;
};

export const getTaskParticipantCount = (task: Task) => {
  const personIds = new Set<string>();
  (task.assignee_person_ids ?? []).forEach((id) => personIds.add(String(id)));
  (task.collaborator_person_ids ?? []).forEach((id) =>
    personIds.add(String(id)),
  );
  const memberIds = new Set<string>();
  (task.mentioned_member_ids ?? []).forEach((id) => memberIds.add(String(id)));
  return personIds.size + memberIds.size;
};

export const taskRequiresAllParticipantsComplete = (task: Task) =>
  getTaskParticipantCount(task) > 1;

export const isParticipantComplete = (
  participants: TaskParticipant[],
  target: { personId?: Identifier; memberId?: Identifier },
) =>
  participants.some((entry) => {
    if (!entry.completed_at) return false;
    if (
      target.personId != null &&
      entry.person_id != null &&
      String(entry.person_id) === String(target.personId)
    ) {
      return true;
    }
    return (
      target.memberId != null &&
      entry.organization_member_id != null &&
      String(entry.organization_member_id) === String(target.memberId)
    );
  });

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
            person_id: entry.person_id ?? null,
            organization_member_id: entry.organization_member_id ?? null,
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
  personId?: Identifier | null,
  organizationMemberId?: Identifier | null,
) =>
  participants.find((entry) => {
    if (
      personId != null &&
      entry.person_id != null &&
      String(entry.person_id) === String(personId)
    ) {
      return true;
    }
    return (
      organizationMemberId != null &&
      entry.organization_member_id != null &&
      String(entry.organization_member_id) === String(organizationMemberId)
    );
  });

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
