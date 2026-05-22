import type { DataProvider, Identifier } from "ra-core";

export type TaskAssigneeRole = "assignee" | "collaborator" | "watcher";

const toNumericIds = (value: unknown): number[] => {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => Number(item))
    .filter((item) => Number.isFinite(item));
};

export const normalizeTaskPersonIds = (
  assigneePersonIds: unknown,
  collaboratorPersonIds: unknown,
) => {
  const assignees = Array.from(new Set(toNumericIds(assigneePersonIds)));
  const assigneeSet = new Set(assignees);
  const collaborators = Array.from(
    new Set(
      toNumericIds(collaboratorPersonIds).filter((id) => !assigneeSet.has(id)),
    ),
  );

  return { assignees, collaborators };
};

export const syncTaskAssignees = async (
  dataProvider: DataProvider,
  taskId: Identifier,
  assigneePersonIds: unknown,
  collaboratorPersonIds: unknown,
) => {
  const { assignees, collaborators } = normalizeTaskPersonIds(
    assigneePersonIds,
    collaboratorPersonIds,
  );

  const existing = await dataProvider.getList<{
    id: Identifier;
    role: TaskAssigneeRole;
  }>("task_assignees", {
    filter: { "task_id@eq": taskId },
    pagination: { page: 1, perPage: 500 },
    sort: { field: "id", order: "ASC" },
  });

  if (existing.data.length > 0) {
    await dataProvider.deleteMany("task_assignees", {
      ids: existing.data.map((item) => item.id),
    });
  }

  await Promise.all([
    ...assignees.map((personId) =>
      dataProvider.create("task_assignees", {
        data: {
          task_id: taskId,
          person_id: personId,
          role: "assignee" satisfies TaskAssigneeRole,
        },
      }),
    ),
    ...collaborators.map((personId) =>
      dataProvider.create("task_assignees", {
        data: {
          task_id: taskId,
          person_id: personId,
          role: "collaborator" satisfies TaskAssigneeRole,
        },
      }),
    ),
  ]);
};

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
  assigneePersonIds: unknown,
  collaboratorPersonIds: unknown,
  mentionedMemberIds: unknown = [],
) => {
  const { assignees, collaborators } = normalizeTaskPersonIds(
    assigneePersonIds,
    collaboratorPersonIds,
  );
  const personIds = [...assignees, ...collaborators];
  const memberIds = toNumericIds(mentionedMemberIds);

  const [{ data: people }, { data: members }] = await Promise.all([
    personIds.length > 0
      ? dataProvider.getList<{ id: Identifier; email?: string | null }>("people", {
          filter: { "id@in": `(${personIds.join(",")})` },
          pagination: { page: 1, perPage: personIds.length },
          sort: { field: "id", order: "ASC" },
        })
      : Promise.resolve({ data: [] }),
    dataProvider.getList<{
      id: Identifier;
      email?: string | null;
      disabled?: boolean;
    }>("organization_members", {
      pagination: { page: 1, perPage: 500 },
      sort: { field: "id", order: "ASC" },
      filter: {},
    }),
  ]);

  const notifications: Promise<unknown>[] = people.flatMap((person) => {
    const normalizedEmail = person.email?.trim().toLowerCase();
    if (!normalizedEmail) return [];

    const recipient = members.find(
      (member) =>
        !member.disabled &&
        member.email?.trim().toLowerCase() === normalizedEmail,
    );
    if (!recipient) return [];

    return [
      dataProvider.create("task_tag_notifications", {
        data: {
          task_id: taskId,
          person_id: person.id,
          recipient_organization_member_id: recipient.id,
        },
      }),
    ];
  });

  memberIds.forEach((memberId) => {
    const recipient = members.find(
      (member) => !member.disabled && String(member.id) === String(memberId),
    );
    if (!recipient) return;

    notifications.push(
      dataProvider.create("task_tag_notifications", {
        data: {
          task_id: taskId,
          person_id: null,
          recipient_organization_member_id: recipient.id,
        },
      }),
    );
  });

  await Promise.all(notifications);
};
