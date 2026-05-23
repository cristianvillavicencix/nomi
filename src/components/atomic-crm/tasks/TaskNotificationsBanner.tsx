import { useMemo } from "react";
import { useGetList, useUpdate, type Identifier } from "ra-core";
import { Bell, CheckCheck } from "lucide-react";
import { Link } from "react-router";
import { Button } from "@/components/ui/button";
import type { Task, TaskTagNotification } from "@/components/atomic-crm/types";
import { TaskMentionText } from "@/components/atomic-crm/tasks/TaskMentionText";
import { useCurrentMemberPerson } from "@/components/atomic-crm/tasks/useCurrentMemberPerson";

export const TaskNotificationsBanner = () => {
  const { identity } = useCurrentMemberPerson();

  const { data: notifications = [], refetch } = useGetList<TaskTagNotification>(
    "task_tag_notifications",
    {
      filter: {
        recipient_organization_member_id: identity?.id,
        "read_at@is": null,
      },
      pagination: { page: 1, perPage: 10 },
      sort: { field: "created_at", order: "DESC" },
    },
    { enabled: identity?.id != null, staleTime: 15_000 },
  );

  const taskIds = useMemo(
    () =>
      Array.from(
        new Set(
          notifications.map((entry) => String(entry.task_id)).filter(Boolean),
        ),
      ),
    [notifications],
  );

  const { data: tasks = [] } = useGetList<Task>(
    "tasks",
    {
      filter:
        taskIds.length > 0
          ? { "id@in": `(${taskIds.join(",")})` }
          : { "id@eq": -1 },
      pagination: { page: 1, perPage: taskIds.length || 1 },
      sort: { field: "id", order: "ASC" },
    },
    { enabled: taskIds.length > 0, staleTime: 15_000 },
  );

  const tasksById = Object.fromEntries(
    tasks.map((task) => [String(task.id), task]),
  );
  const [update] = useUpdate();

  if (notifications.length === 0) return null;

  const markAllRead = async () => {
    await Promise.all(
      notifications.map((notification) =>
        update(
          "task_tag_notifications",
          {
            id: notification.id,
            data: { read_at: new Date().toISOString() },
            previousData: notification,
          },
          { returnPromise: true },
        ),
      ),
    );
    await refetch();
  };

  const markOneRead = async (notification: TaskTagNotification) => {
    await update(
      "task_tag_notifications",
      {
        id: notification.id,
        data: { read_at: new Date().toISOString() },
        previousData: notification,
      },
      { returnPromise: true },
    );
    await refetch();
  };

  return (
    <div className="rounded-lg border border-primary/20 bg-primary/5 p-4">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-sm font-medium">
          <Bell className="size-4 text-primary" />
          You were tagged on {notifications.length} task
          {notifications.length === 1 ? "" : "s"}
        </div>
        <Button type="button" variant="ghost" size="sm" onClick={markAllRead}>
          <CheckCheck className="size-4" />
          Mark all read
        </Button>
      </div>
      <ul className="space-y-2">
        {notifications.map((notification) => {
          const task = tasksById[String(notification.task_id)];
          return (
            <li
              key={String(notification.id)}
              className="flex items-start justify-between gap-3 rounded-md bg-background/80 px-3 py-2 text-sm"
            >
              <div className="min-w-0">
                <Link
                  to="/tasks"
                  className="font-medium link-action"
                  onClick={() => markOneRead(notification)}
                >
                  {task?.text?.trim() ? (
                    <TaskMentionText text={task.text} />
                  ) : (
                    `Task #${notification.task_id}`
                  )}
                </Link>
                {task?.deal_id ? (
                  <div className="text-xs text-muted-foreground">
                    Project task ·{" "}
                    <Link
                      to={`/deals/${task.deal_id}/show?tab=tasks`}
                      className="link-action"
                      onClick={() => markOneRead(notification)}
                    >
                      View project
                    </Link>
                  </div>
                ) : null}
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => markOneRead(notification)}
              >
                Dismiss
              </Button>
            </li>
          );
        })}
      </ul>
    </div>
  );
};

export const useUnreadTaskNotificationCount = (
  organizationMemberId?: Identifier | null,
) => {
  const { total } = useGetList<TaskTagNotification>(
    "task_tag_notifications",
    {
      filter: {
        recipient_organization_member_id: organizationMemberId,
        "read_at@is": null,
      },
      pagination: { page: 1, perPage: 1 },
      sort: { field: "id", order: "ASC" },
    },
    { enabled: organizationMemberId != null, staleTime: 15_000 },
  );

  return total ?? 0;
};
