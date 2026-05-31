import type { Identifier } from "ra-core";
import type { Task } from "@/components/atomic-crm/types";
import type { TaskStatusFilter } from "@/components/atomic-crm/tasks/taskConstants";
import { TASK_STATUS_FILTERS } from "@/components/atomic-crm/tasks/taskConstants";

export type TaskScopeFilter = "mine" | "team" | "my_projects" | "tagged";

export type GetScopedTasksParams = {
  scope: TaskScopeFilter;
  organizationMemberId: Identifier;
  personId?: Identifier | null;
  projectDealIds?: Identifier[];
  projectId?: Identifier | null;
  status: TaskStatusFilter;
  typeFilter?: string;
  priorityFilter?: string;
  pagination?: { page: number; perPage: number };
  sort?: { field: string; order: "ASC" | "DESC" };
};

export type GetScopedTasksResult = {
  data: Task[];
  total: number;
};

export const buildScopedTaskFilter = ({
  scope,
  organizationMemberId,
  personId,
  projectDealIds,
  status,
  typeFilter = "all",
  priorityFilter = "all",
}: Omit<GetScopedTasksParams, "pagination" | "sort">) => {
  const filter: Record<string, unknown> = {
    ...TASK_STATUS_FILTERS[status],
  };

  if (typeFilter !== "all") {
    filter.type = typeFilter;
  }
  if (priorityFilter !== "all") {
    filter.priority = priorityFilter;
  }

  if (scope === "mine") {
    filter["@scope"] = "mine";
    filter.organization_member_id = organizationMemberId;
    if (personId != null) {
      filter["@person_id"] = personId;
    }
  } else if (scope === "my_projects") {
    filter["@scope"] = "my_projects";
    filter["@project_deal_ids"] = projectDealIds ?? [];
  }

  return filter;
};

export const taskMatchesMineScope = (
  task: Task,
  organizationMemberId: Identifier,
  personId?: Identifier | null,
) => {
  const memberKey = String(organizationMemberId);
  const mentionedMembers = (task.mentioned_member_ids ?? []).map(String);
  if (mentionedMembers.includes(memberKey)) {
    return true;
  }

  if (String(task.organization_member_id) === memberKey) {
    return true;
  }

  if (personId == null) return false;

  const personKey = String(personId);
  const assignees = (task.assignee_person_ids ?? []).map(String);
  const collaborators = (task.collaborator_person_ids ?? []).map(String);
  return assignees.includes(personKey) || collaborators.includes(personKey);
};

export const taskMatchesProjectScope = (
  task: Task,
  projectDealIds: Identifier[],
) => {
  if (task.deal_id == null || projectDealIds.length === 0) return false;
  return projectDealIds.some(
    (dealId) => String(dealId) === String(task.deal_id),
  );
};
