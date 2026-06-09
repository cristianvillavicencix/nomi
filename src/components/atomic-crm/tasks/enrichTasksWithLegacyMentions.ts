import type { DataProvider } from "ra-core";
import type { OrganizationMember, Task } from "@/components/atomic-crm/types";
import { migrateLegacyTaskRecord } from "@/components/atomic-crm/tasks/taskMentions";

export const enrichTasksWithLegacyMentions = async (
  tasks: Task[],
  dataProvider: DataProvider,
) => {
  const memberIds = Array.from(
    new Set(
      tasks.flatMap((task) => [
        ...(task.assignee_person_ids ?? []),
        ...(task.collaborator_person_ids ?? []),
        task.organization_member_id,
      ]),
    ),
  ).filter((id) => id != null && id !== "");

  const { data: members } =
    memberIds.length > 0
      ? await dataProvider.getList<OrganizationMember>("organization_members", {
          filter: { "id@in": `(${memberIds.join(",")})` },
          pagination: { page: 1, perPage: memberIds.length },
          sort: { field: "id", order: "ASC" },
        })
      : { data: [] as OrganizationMember[] };

  const membersById = Object.fromEntries(
    members.map((member) => [String(member.id), member]),
  );

  return tasks.map((task) =>
    migrateLegacyTaskRecord(
      task,
      membersById,
      task.organization_member_id != null
        ? membersById[String(task.organization_member_id)]
        : undefined,
    ),
  );
};
