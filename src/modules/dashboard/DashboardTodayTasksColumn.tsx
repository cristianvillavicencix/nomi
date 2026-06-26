import { endOfToday, format, isToday, startOfToday } from "date-fns";
import { CheckSquare, ChevronRight } from "lucide-react";
import { Link } from "react-router";
import { useGetIdentity, useGetList } from "ra-core";

import { AddTask } from "@/components/atomic-crm/tasks/AddTask";
import { TaskDescriptionCell } from "@/components/atomic-crm/tasks/TaskDescriptionCell";
import { TASK_STATUS_FILTERS } from "@/components/atomic-crm/tasks/taskConstants";
import { isTaskOverdue } from "@/components/atomic-crm/tasks/taskStats";
import { useTaskCompletionToggle } from "@/components/atomic-crm/tasks/useTaskCompletionToggle";
import { useTaskParticipantsByTaskIds } from "@/components/atomic-crm/tasks/useTaskParticipants";
import type { Task } from "@/components/atomic-crm/types";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

const formatTaskDueTime = (value: string) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";

  if (isToday(date)) {
    const hasTime =
      value.includes("T") &&
      !(date.getHours() === 0 && date.getMinutes() === 0);
    return hasTime ? format(date, "h:mm a") : "Today";
  }

  return format(date, "MMM d");
};

const DashboardTodayTaskRow = ({
  task,
  participants,
}: {
  task: Task;
  participants: ReturnType<
    typeof useTaskParticipantsByTaskIds
  >["participantsByTaskId"][string];
}) => {
  const overdue = isTaskOverdue(task);
  const { toggle, checkboxChecked, checkboxDisabled, isPending } =
    useTaskCompletionToggle(task, participants ?? []);

  return (
    <li className="flex items-start gap-2.5 rounded-md border border-transparent px-2 py-2 transition-colors hover:border-border hover:bg-muted/40">
      <Checkbox
        checked={checkboxChecked}
        disabled={checkboxDisabled || isPending}
        onCheckedChange={() => void toggle()}
        className="mt-0.5"
        aria-label={`Mark task complete: ${task.text}`}
      />

      <div className="min-w-0 flex-1">
        <TaskDescriptionCell
          text={task.text}
          isDone={checkboxChecked}
          useMentions
          fadeSurface="card"
          enablePreview={false}
        />
        <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5">
          <span
            className={cn(
              "text-xs",
              overdue
                ? "font-medium text-red-600 dark:text-red-400"
                : "text-muted-foreground",
            )}
          >
            {overdue ? "Overdue" : formatTaskDueTime(task.due_date)}
          </span>
          {task.deal_id ? (
            <Link
              to={`/deals/${task.deal_id}/show?tab=tasks`}
              className="text-xs link-action truncate"
            >
              Project
            </Link>
          ) : null}
        </div>
      </div>
    </li>
  );
};

export const DashboardTodayTasksColumn = () => {
  const { identity } = useGetIdentity();
  const todayLabel = format(new Date(), "EEEE, MMMM d");

  const { data: tasks = [], isPending } = useGetList<Task>(
    "tasks",
    {
      filter: {
        ...TASK_STATUS_FILTERS.open,
        organization_member_id: identity?.id,
        "due_date@lte": endOfToday().toISOString(),
      },
      pagination: { page: 1, perPage: 200 },
      sort: { field: "due_date", order: "ASC" },
    },
    { enabled: !!identity?.id, staleTime: 30_000 },
  );

  const taskIds = tasks.map((task) => task.id);
  const { participantsByTaskId, isPending: participantsPending } =
    useTaskParticipantsByTaskIds(taskIds);

  const overdueTasks = tasks.filter((task) => isTaskOverdue(task));
  const dueTodayTasks = tasks.filter((task) => {
    const due = new Date(task.due_date);
    return due >= startOfToday() && due <= endOfToday() && !isTaskOverdue(task);
  });

  const loading = isPending || participantsPending;

  return (
    <div className="flex min-h-0 flex-col gap-2 xl:sticky xl:top-2 xl:max-h-[calc(100svh-5.5rem)]">
      <div className="flex items-center gap-2">
        <CheckSquare className="size-6 shrink-0 text-muted-foreground" />
        <div className="min-w-0 flex-1">
          <h2 className="text-xl font-semibold text-muted-foreground">
            Today&apos;s tasks
          </h2>
          <p className="truncate text-xs text-muted-foreground">{todayLabel}</p>
        </div>
        <AddTask display="icon" selectContact />
      </div>

      <Card className="flex min-h-[320px] min-w-0 flex-1 flex-col gap-4 p-4 xl:min-h-0">
        {loading ? (
          <div className="space-y-2">
            <Skeleton className="h-5 w-32" />
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
          </div>
        ) : (
          <>
            <div className="flex flex-wrap gap-2">
              <Badge variant="outline">{dueTodayTasks.length} due today</Badge>
              {overdueTasks.length > 0 ? (
                <Badge
                  variant="outline"
                  className="border-red-200 text-red-700 dark:border-red-900/50 dark:text-red-400"
                >
                  {overdueTasks.length} overdue
                </Badge>
              ) : null}
            </div>

            <div className="-mx-2 min-h-0 flex-1 overflow-y-auto">
              {tasks.length === 0 ? (
                <p className="px-2 text-sm text-muted-foreground">
                  Nothing due today. You&apos;re all caught up.
                </p>
              ) : (
                <div className="space-y-4">
                  {overdueTasks.length > 0 ? (
                    <div>
                      <p className="mb-1 px-2 text-xs font-medium uppercase tracking-wide text-red-600 dark:text-red-400">
                        Overdue
                      </p>
                      <ul className="space-y-0.5">
                        {overdueTasks.map((task) => (
                          <DashboardTodayTaskRow
                            key={String(task.id)}
                            task={task}
                            participants={participantsByTaskId[String(task.id)]}
                          />
                        ))}
                      </ul>
                    </div>
                  ) : null}

                  {dueTodayTasks.length > 0 ? (
                    <div>
                      {overdueTasks.length > 0 ? (
                        <p className="mb-1 px-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                          Due today
                        </p>
                      ) : null}
                      <ul className="space-y-0.5">
                        {dueTodayTasks.map((task) => (
                          <DashboardTodayTaskRow
                            key={String(task.id)}
                            task={task}
                            participants={participantsByTaskId[String(task.id)]}
                          />
                        ))}
                      </ul>
                    </div>
                  ) : null}
                </div>
              )}
            </div>

            <Link
              to="/tasks"
              className="mt-auto inline-flex items-center gap-1 text-sm link-action"
            >
              View all tasks
              <ChevronRight className="size-4" />
            </Link>
          </>
        )}
      </Card>
    </div>
  );
};
