import type { DataProvider } from "ra-core";
import type {
  OrganizationMember,
  Person,
  Task,
} from "@/components/atomic-crm/types";
import { migrateLegacyTaskRecord } from "@/components/atomic-crm/tasks/taskMentions";

export const enrichTasksWithLegacyMentions = async (
  tasks: Task[],
  dataProvider: DataProvider,
) => {
  const personIds = Array.from(
    new Set(
      tasks.flatMap((task) => [
        ...(task.assignee_person_ids ?? []),
        ...(task.collaborator_person_ids ?? []),
      ]),
    ),
  );
  const memberIds = Array.from(
    new Set(tasks.map((task) => task.organization_member_id).filter(Boolean)),
  );

  const [{ data: people }, { data: members }] = await Promise.all([
    personIds.length > 0
      ? dataProvider.getList<Person>("people", {
          filter: { "id@in": `(${personIds.join(",")})` },
          pagination: { page: 1, perPage: personIds.length },
          sort: { field: "id", order: "ASC" },
        })
      : Promise.resolve({ data: [] as Person[], total: 0 }),
    memberIds.length > 0
      ? dataProvider.getList<OrganizationMember>("organization_members", {
          filter: { "id@in": `(${memberIds.join(",")})` },
          pagination: { page: 1, perPage: memberIds.length },
          sort: { field: "id", order: "ASC" },
        })
      : Promise.resolve({ data: [] as OrganizationMember[], total: 0 }),
  ]);

  const peopleById = Object.fromEntries(
    people.map((person) => [String(person.id), person]),
  );
  const membersById = Object.fromEntries(
    members.map((member) => [String(member.id), member]),
  );

  return tasks.map((task) =>
    migrateLegacyTaskRecord(
      task,
      peopleById,
      task.organization_member_id != null
        ? membersById[String(task.organization_member_id)]
        : undefined,
    ),
  );
};
