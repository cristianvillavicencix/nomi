import { useMemo } from "react";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { useConfigurationContext } from "@/components/atomic-crm/root/ConfigurationContext";
import { type TaskStatusFilter } from "@/components/atomic-crm/tasks/taskConstants";
import { TaskTable } from "@/components/atomic-crm/tasks/TaskTable";
import { TaskNotificationsBanner } from "@/components/atomic-crm/tasks/TaskNotificationsBanner";
import { TasksFilterPopover } from "@/components/atomic-crm/tasks/TasksFilterPopover";
import { useCurrentMemberPerson } from "@/components/atomic-crm/tasks/useCurrentMemberPerson";
import {
  useMyProjectDealIds,
  useScopedTasks,
} from "@/components/atomic-crm/tasks/useScopedTasks";
import { useTaskPreferences } from "@/components/atomic-crm/tasks/useTaskPreferences";
import { isLbsMode } from "@/lbs/productMode";

export const TasksPageContent = () => {
  const {
    identity,
    personId,
    isPending: isMemberPending,
  } = useCurrentMemberPerson();
  const { taskTypes } = useConfigurationContext();
  const { preferences, setPreferences } = useTaskPreferences();
  const { status, scope, typeFilter, priorityFilter, projectId } = preferences;
  const lbsMode = isLbsMode();

  const { data: projectDealIds = [], isPending: isProjectsPending } =
    useMyProjectDealIds({
      organizationMemberId: identity?.id,
      personId,
      enabled: lbsMode && scope === "my_projects",
    });

  const { data: scopedTasksResult, isPending: isTasksPending } = useScopedTasks(
    {
      scope,
      organizationMemberId: identity?.id,
      personId,
      projectDealIds,
      projectId: lbsMode ? projectId : null,
      status,
      typeFilter: lbsMode ? "all" : typeFilter,
      priorityFilter,
      enabled: scope !== "my_projects" || projectDealIds.length > 0,
    },
  );

  const tasks = scopedTasksResult?.data ?? [];
  const isPending =
    isMemberPending ||
    isTasksPending ||
    (scope === "my_projects" && isProjectsPending);

  const scopeOptions = useMemo(() => {
    const options = [
      { value: "mine" as const, label: "My tasks" },
      { value: "team" as const, label: "All team" },
    ];
    if (lbsMode) {
      return [
        ...options,
        { value: "my_projects" as const, label: "My projects" },
      ];
    }
    return options;
  }, [lbsMode]);

  if (isPending) {
    return (
      <div className="space-y-2">
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {lbsMode ? <TaskNotificationsBanner /> : null}

      <div className="flex flex-wrap items-center justify-between gap-2">
        <Tabs
          value={status}
          onValueChange={(value) =>
            setPreferences({ status: value as TaskStatusFilter })
          }
        >
          <TabsList>
            <TabsTrigger value="open">Open</TabsTrigger>
            <TabsTrigger value="done">Done</TabsTrigger>
          </TabsList>
        </Tabs>

        <TasksFilterPopover
          preferences={preferences}
          onChange={setPreferences}
          scopeOptions={scopeOptions}
          taskTypes={taskTypes}
          lbsMode={lbsMode}
        />
      </div>

      <TaskTable
        tasks={tasks}
        status={status}
        showContact={!lbsMode}
        showProject={lbsMode && projectId == null}
        emptyMessage={
          scope === "my_projects" && projectDealIds.length === 0
            ? "You are not assigned to any projects yet."
            : status === "done"
              ? "No completed tasks match these filters."
              : "No open tasks match these filters."
        }
      />
    </div>
  );
};
