import type { DataProvider, Identifier } from "ra-core";
import type { TaskTagNotification } from "@/components/atomic-crm/types";
import { getTaskAssignmentPayload } from "@/components/atomic-crm/tasks/persistTaskAssignmentSideEffects";

export const TASK_DUE_DATE_NOTIFICATION_KIND = "due_date_rescheduled" as const;
export const TASK_MENTION_NOTIFICATION_KIND = "mention" as const;

export type TaskTagNotificationKind =
  | typeof TASK_DUE_DATE_NOTIFICATION_KIND
  | typeof TASK_MENTION_NOTIFICATION_KIND;

export const getTaskNotificationMemberIds = (
  task: Record<string, unknown>,
): number[] => {
  const payload = getTaskAssignmentPayload(task);
  const ids = new Set<number>([
    ...payload.assignee_person_ids,
    ...payload.collaborator_person_ids,
  ]);
  const ownerId = Number(task.organization_member_id);
  if (Number.isFinite(ownerId)) {
    ids.add(ownerId);
  }
  return Array.from(ids);
};

export const refreshTaskDueDateNotifications = async (
  dataProvider: DataProvider,
  taskId: Identifier,
  memberIds: number[],
) => {
  if (memberIds.length === 0) return;

  const { data: existing = [] } =
    await dataProvider.getList<TaskTagNotification>("task_tag_notifications", {
      filter: { "task_id@eq": taskId },
      pagination: { page: 1, perPage: 500 },
      sort: { field: "id", order: "ASC" },
    });

  const { data: members = [] } = await dataProvider.getList<{
    id: Identifier;
    disabled?: boolean;
  }>("organization_members", {
    pagination: { page: 1, perPage: 500 },
    sort: { field: "id", order: "ASC" },
    filter: {},
  });

  const activeMemberIds = memberIds.filter((memberId) =>
    members.some(
      (member) => !member.disabled && String(member.id) === String(memberId),
    ),
  );

  await Promise.allSettled(
    activeMemberIds.map(async (memberId) => {
      const existingRow = existing.find(
        (row) =>
          String(row.recipient_organization_member_id) === String(memberId),
      );

      if (existingRow) {
        await dataProvider.update("task_tag_notifications", {
          id: existingRow.id,
          data: {
            kind: TASK_DUE_DATE_NOTIFICATION_KIND,
            read_at: null,
          },
          previousData: existingRow,
        });
        return;
      }

      await dataProvider.create("task_tag_notifications", {
        data: {
          task_id: taskId,
          recipient_organization_member_id: memberId,
          kind: TASK_DUE_DATE_NOTIFICATION_KIND,
        },
      });
    }),
  );
};
