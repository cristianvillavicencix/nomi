import type { DataProvider, Identifier } from "ra-core";
import type { TaskTagNotification } from "@/components/atomic-crm/types";

export type TaskAssigneeRole = "assignee" | "collaborator" | "watcher";

const toNumericIds = (value: unknown): number[] => {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => Number(item))
    .filter((item) => Number.isFinite(item));
};

export const normalizeTaskMemberIds = (
  assigneeMemberIds: unknown,
  collaboratorMemberIds: unknown,
) => {
  const assignees = Array.from(new Set(toNumericIds(assigneeMemberIds)));
  const assigneeSet = new Set(assignees);
  const collaborators = Array.from(
    new Set(
      toNumericIds(collaboratorMemberIds).filter((id) => !assigneeSet.has(id)),
    ),
  );

  return { assignees, collaborators };
};

/** @deprecated Legacy people junction — no longer synced. */
export const syncTaskAssignees = async (
  _dataProvider: DataProvider,
  _taskId: Identifier,
  _assigneePersonIds: unknown,
  _collaboratorPersonIds: unknown,
) => undefined;

/** @deprecated Alias for normalizeTaskMemberIds */
export const normalizeTaskPersonIds = normalizeTaskMemberIds;

export const stripTaskAssignmentFields = (data: Record<string, unknown>) => {
  const {
    assignee_person_ids: _assigneePersonIds,
    collaborator_person_ids: _collaboratorPersonIds,
    ...rest
  } = data;
  return rest;
};

export const createTaskTagNotifications = async (
  dataProvider: DataProvider,
  taskId: Identifier,
  assigneeMemberIds: unknown,
  collaboratorMemberIds: unknown,
  mentionedMemberIds: unknown = [],
) => {
  const { assignees, collaborators } = normalizeTaskMemberIds(
    assigneeMemberIds,
    collaboratorMemberIds,
  );
  const memberIds = [
    ...new Set([
      ...assignees,
      ...collaborators,
      ...toNumericIds(mentionedMemberIds),
    ]),
  ];

  const { data: existing = [] } =
    await dataProvider.getList<TaskTagNotification>("task_tag_notifications", {
      filter: { "task_id@eq": taskId },
      pagination: { page: 1, perPage: 500 },
      sort: { field: "id", order: "ASC" },
    });

  const existingKeys = new Set(
    existing.map((entry) => `member:${entry.recipient_organization_member_id}`),
  );

  const { data: members } = await dataProvider.getList<{
    id: Identifier;
    disabled?: boolean;
  }>("organization_members", {
    pagination: { page: 1, perPage: 500 },
    sort: { field: "id", order: "ASC" },
    filter: {},
  });

  const notifications: Promise<unknown>[] = [];

  memberIds.forEach((memberId) => {
    const recipient = members.find(
      (member) => !member.disabled && String(member.id) === String(memberId),
    );
    if (!recipient) return;

    const key = `member:${recipient.id}`;
    if (existingKeys.has(key)) return;

    notifications.push(
      dataProvider.create("task_tag_notifications", {
        data: {
          task_id: taskId,
          recipient_organization_member_id: recipient.id,
        },
      }),
    );
  });

  await Promise.allSettled(notifications);
};
