import { useQuery } from "@tanstack/react-query";
import { useDataProvider } from "ra-core";
import type { CrmDataProvider } from "@/components/atomic-crm/providers/types";
import type { TaskStatusFilter } from "@/components/atomic-crm/tasks/taskConstants";
import type { TaskScopeFilter } from "@/components/atomic-crm/tasks/scopedTasks";
import type { Identifier } from "ra-core";

export const useScopedTasks = ({
  scope,
  organizationMemberId,
  personId,
  projectDealIds,
  projectId,
  status,
  typeFilter,
  priorityFilter,
  enabled = true,
}: {
  scope: TaskScopeFilter;
  organizationMemberId?: Identifier | null;
  personId?: Identifier | null;
  projectDealIds?: Identifier[];
  projectId?: Identifier | null;
  status: TaskStatusFilter;
  typeFilter: string;
  priorityFilter: string;
  enabled?: boolean;
}) => {
  const dataProvider = useDataProvider<CrmDataProvider>();

  return useQuery({
    queryKey: [
      "scopedTasks",
      scope,
      organizationMemberId,
      personId,
      projectDealIds,
      projectId,
      status,
      typeFilter,
      priorityFilter,
    ],
    queryFn: () =>
      dataProvider.getScopedTasks({
        scope,
        organizationMemberId: organizationMemberId!,
        personId,
        projectDealIds,
        projectId,
        status,
        typeFilter,
        priorityFilter,
        pagination: { page: 1, perPage: 200 },
        sort: {
          field: status === "done" ? "done_date" : "due_date",
          order: status === "done" ? "DESC" : "ASC",
        },
      }),
    enabled:
      enabled &&
      organizationMemberId != null &&
      (scope !== "my_projects" || (projectDealIds?.length ?? 0) > 0),
    staleTime: 15_000,
  });
};

export const useMyProjectDealIds = ({
  organizationMemberId,
  personId,
  enabled = true,
}: {
  organizationMemberId?: Identifier | null;
  personId?: Identifier | null;
  enabled?: boolean;
}) => {
  const dataProvider = useDataProvider<CrmDataProvider>();

  return useQuery({
    queryKey: ["myProjectDealIds", organizationMemberId, personId],
    queryFn: () =>
      dataProvider.getMyProjectDealIds({
        organizationMemberId: organizationMemberId!,
        personId,
      }),
    enabled: enabled && organizationMemberId != null,
    staleTime: 60_000,
  });
};
