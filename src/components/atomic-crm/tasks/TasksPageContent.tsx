import { useMemo } from "react";
import { CheckCheck } from "lucide-react";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useConfigurationContext } from "@/components/atomic-crm/root/ConfigurationContext";
import { type TaskStatusFilter } from "@/components/atomic-crm/tasks/taskConstants";
import { TaskTable } from "@/components/atomic-crm/tasks/TaskTable";
import { TasksCalendarPanel } from "@/components/atomic-crm/tasks/TasksCalendarPanel";
import { TasksFilterPopover } from "@/components/atomic-crm/tasks/TasksFilterPopover";
import { useCurrentMemberPerson } from "@/components/atomic-crm/tasks/useCurrentMemberPerson";
import {
  useMyProjectDealIds,
  useScopedTasks,
} from "@/components/atomic-crm/tasks/useScopedTasks";
import { useTaskPreferences } from "@/components/atomic-crm/tasks/useTaskPreferences";
import {
  useMarkTaskTagNotificationsRead,
  useUnreadTaskTagNotifications,
} from "@/components/atomic-crm/tasks/useTaskTagNotifications";
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
  const {
    notifications: unreadTagNotifications,
    total: unreadTaggedCount,
    refetch: refetchTagNotifications,
  } = useUnreadTaskTagNotifications(identity?.id);
  const { markRead } = useMarkTaskTagNotificationsRead();

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
    const taggedLabel =
      unreadTaggedCount > 0 ? `Tagged me (${unreadTaggedCount})` : "Tagged me";

    const options = [
      { value: "mine" as const, label: "My tasks" },
      { value: "tagged" as const, label: taggedLabel },
      { value: "team" as const, label: "All team" },
    ];
    if (lbsMode) {
      return [
        ...options,
        { value: "my_projects" as const, label: "My projects" },
      ];
    }
    return options;
  }, [lbsMode, unreadTaggedCount]);

  const emptyMessage = useMemo(() => {
    if (scope === "tagged") {
      return unreadTaggedCount === 0
        ? "No unread @ mentions."
        : status === "done"
          ? "No completed tasks in your unread mentions."
          : "No open tasks in your unread mentions.";
    }
    if (scope === "my_projects" && projectDealIds.length === 0) {
      return "You are not assigned to any projects yet.";
    }
    return status === "done"
      ? "No completed tasks match these filters."
      : "No open tasks match these filters.";
  }, [scope, status, unreadTaggedCount, projectDealIds.length]);

  const markAllTaggedRead = async () => {
    await markRead(unreadTagNotifications);
    await refetchTagNotifications();
  };

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

        <div className="flex flex-wrap items-center gap-2">
          {scope === "tagged" && unreadTagNotifications.length > 0 ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={markAllTaggedRead}
            >
              <CheckCheck className="size-4" />
              Mark all read
            </Button>
          ) : null}

          <TasksFilterPopover
            preferences={preferences}
            onChange={setPreferences}
            scopeOptions={scopeOptions}
            taskTypes={taskTypes}
            lbsMode={lbsMode}
            unreadTaggedCount={unreadTaggedCount}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1fr)_360px] xl:items-start">
        <TaskTable
          tasks={tasks}
          status={status}
          showContact={!lbsMode}
          showProject={lbsMode && projectId == null}
          emptyMessage={emptyMessage}
        />

        <div className="hidden xl:block">
          <TasksCalendarPanel tasks={tasks} />
        </div>
      </div>
    </div>
  );
};
