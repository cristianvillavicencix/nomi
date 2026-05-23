import { Link } from "react-router";
import { useGetIdentity, useGetList } from "ra-core";
import { CheckSquare, ChevronRight } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { AddTask } from "@/components/atomic-crm/tasks/AddTask";
import { TASK_STATUS_FILTERS } from "@/components/atomic-crm/tasks/taskConstants";
import {
  computeTaskStats,
  isTaskOverdue,
} from "@/components/atomic-crm/tasks/taskStats";
import { TaskDescriptionCell } from "@/components/atomic-crm/tasks/TaskDescriptionCell";
import type { Task } from "@/components/atomic-crm/types";

const formatDue = (value: string) =>
  new Date(value).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });

export const LbsDashboardTasks = () => {
  const { identity } = useGetIdentity();

  const { data: myTasks = [], isPending: myPending } = useGetList<Task>(
    "tasks",
    {
      filter: {
        ...TASK_STATUS_FILTERS.open,
        organization_member_id: identity?.id,
      },
      pagination: { page: 1, perPage: 100 },
      sort: { field: "due_date", order: "ASC" },
    },
    { enabled: !!identity, staleTime: 30_000 },
  );

  const { total: unassigned = 0, isPending: unassignedPending } =
    useGetList<Task>(
      "tasks",
      {
        filter: {
          ...TASK_STATUS_FILTERS.open,
          "organization_member_id@is": null,
        },
        pagination: { page: 1, perPage: 1 },
        sort: { field: "due_date", order: "ASC" },
      },
      { staleTime: 30_000 },
    );

  const isPending = myPending || unassignedPending;
  const stats = computeTaskStats(myTasks);
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const todayEnd = new Date(todayStart);
  todayEnd.setHours(23, 59, 59, 999);

  const dueToday = myTasks.filter((task) => {
    const due = new Date(task.due_date);
    return due >= todayStart && due <= todayEnd;
  });

  const preview = [...myTasks]
    .sort((left, right) => {
      const leftOverdue = isTaskOverdue(left) ? 0 : 1;
      const rightOverdue = isTaskOverdue(right) ? 0 : 1;
      if (leftOverdue !== rightOverdue) return leftOverdue - rightOverdue;
      return (
        new Date(left.due_date).getTime() - new Date(right.due_date).getTime()
      );
    })
    .slice(0, 5);

  if (isPending) {
    return (
      <Card className="p-4 space-y-2">
        <Skeleton className="h-6 w-32" />
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-full" />
      </Card>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center">
        <div className="mr-3 flex">
          <CheckSquare className="text-muted-foreground h-6 w-6" />
        </div>
        <h2 className="text-xl font-semibold text-muted-foreground flex-1">
          My tasks
        </h2>
        <AddTask display="icon" selectContact />
      </div>
      <Card className="p-4 space-y-4">
        <div className="flex flex-wrap gap-2 text-xs">
          <Badge variant="outline">{dueToday.length} due today</Badge>
          {stats.overdue > 0 ? (
            <Badge variant="outline" className="border-red-200 text-red-700">
              {stats.overdue} overdue
            </Badge>
          ) : null}
          {unassigned > 0 ? (
            <Badge variant="secondary">{unassigned} unassigned team-wide</Badge>
          ) : null}
        </div>

        {preview.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No open tasks assigned to you.
          </p>
        ) : (
          <ul className="space-y-2">
            {preview.map((task) => (
              <li
                key={String(task.id)}
                className="flex items-start justify-between gap-2 text-sm"
              >
                <div className="min-w-0 flex-1">
                  <TaskDescriptionCell
                    text={task.text}
                    useMentions
                    fadeSurface="card"
                  />
                  {task.deal_id ? (
                    <Link
                      to={`/deals/${task.deal_id}/show?tab=tasks`}
                      className="text-xs link-action truncate block"
                    >
                      View project
                    </Link>
                  ) : null}
                </div>
                <span
                  className={`shrink-0 text-xs ${isTaskOverdue(task) ? "font-medium text-red-600" : "text-muted-foreground"}`}
                >
                  {formatDue(task.due_date)}
                </span>
              </li>
            ))}
          </ul>
        )}

        <Link
          to="/tasks"
          className="inline-flex items-center gap-1 text-sm link-action"
        >
          View all tasks
          <ChevronRight className="size-4" />
        </Link>
      </Card>
    </div>
  );
};
