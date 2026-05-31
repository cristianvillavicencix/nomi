import type { Identifier } from "ra-core";
import type { Task, TaskParticipant } from "@/components/atomic-crm/types";
import type {
  GetScopedTasksParams,
  GetScopedTasksResult,
} from "@/components/atomic-crm/tasks/scopedTasks";
import {
  taskMatchesMineScope,
  taskMatchesProjectScope,
} from "@/components/atomic-crm/tasks/scopedTasks";
import {
  isTaskDoneForUser,
  isTaskOpenForUser,
  scopeUsesUserCompletionFilter,
} from "@/components/atomic-crm/tasks/taskUserCompletion";

export const filterScopedTasks = (
  tasks: Task[],
  params: GetScopedTasksParams,
  participantsByTaskId: Record<string, TaskParticipant[]> = {},
): GetScopedTasksResult => {
  const usesUserCompletion = scopeUsesUserCompletionFilter(params.scope);

  let filtered = tasks.filter((task) => {
    const participants = participantsByTaskId[String(task.id)] ?? [];
    if (usesUserCompletion) {
      return params.status === "open"
        ? isTaskOpenForUser(
            task,
            participants,
            params.organizationMemberId,
            params.personId,
          )
        : isTaskDoneForUser(
            task,
            participants,
            params.organizationMemberId,
            params.personId,
          );
    }

    if (params.status === "open") {
      return task.done_date == null;
    }
    return task.done_date != null;
  });

  if (params.typeFilter && params.typeFilter !== "all") {
    filtered = filtered.filter((task) => task.type === params.typeFilter);
  }
  if (params.priorityFilter && params.priorityFilter !== "all") {
    filtered = filtered.filter(
      (task) => task.priority === params.priorityFilter,
    );
  }
  if (params.projectId != null && params.projectId !== "") {
    filtered = filtered.filter(
      (task) =>
        task.deal_id != null &&
        String(task.deal_id) === String(params.projectId),
    );
  }

  if (params.scope === "mine") {
    filtered = filtered.filter((task) =>
      taskMatchesMineScope(task, params.organizationMemberId, params.personId),
    );
  } else if (params.scope === "my_projects") {
    filtered = filtered.filter((task) =>
      taskMatchesProjectScope(task, params.projectDealIds ?? []),
    );
  }
  // scope "tagged" and "team": tasks are pre-filtered in the data provider

  const sortField = params.sort?.field ?? "due_date";
  const sortMultiplier = params.sort?.order === "DESC" ? -1 : 1;
  filtered.sort((left, right) => {
    const leftValue = left[sortField as keyof Task];
    const rightValue = right[sortField as keyof Task];
    return (
      String(leftValue ?? "").localeCompare(
        String(rightValue ?? ""),
        undefined,
        {
          numeric: true,
        },
      ) * sortMultiplier
    );
  });

  const page = params.pagination?.page ?? 1;
  const perPage = params.pagination?.perPage ?? 200;
  const start = (page - 1) * perPage;

  return {
    data: filtered.slice(start, start + perPage),
    total: filtered.length,
  };
};

export const collectMyProjectDealIds = (
  deals: Array<{
    id: Identifier;
    organization_member_id?: Identifier | null;
    salesperson_ids?: Identifier[];
  }>,
  organizationMemberId: Identifier,
  personId?: Identifier | null,
) => {
  const dealIds = new Set<string>();

  deals.forEach((deal) => {
    if (String(deal.organization_member_id) === String(organizationMemberId)) {
      dealIds.add(String(deal.id));
    }
    if (
      personId != null &&
      Array.isArray(deal.salesperson_ids) &&
      deal.salesperson_ids.some((id) => String(id) === String(personId))
    ) {
      dealIds.add(String(deal.id));
    }
  });

  return Array.from(dealIds);
};
