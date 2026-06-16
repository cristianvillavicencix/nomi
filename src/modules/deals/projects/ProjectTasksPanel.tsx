import { useMemo, useState } from "react";
import { useGetList } from "ra-core";

import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AddTask } from "@/components/atomic-crm/tasks/AddTask";
import {
  TASK_STATUS_FILTERS,
  type TaskStatusFilter,
} from "@/components/atomic-crm/tasks/taskConstants";
import { TaskTable } from "@/components/atomic-crm/tasks/TaskTable";
import { computeTaskStats } from "@/components/atomic-crm/tasks/taskStats";
import { ProjectTaskStats } from "@/modules/deals/ProjectTaskStats";
import {
  ProjectTasksCalendar,
  toDateKey,
  type CalendarFilterValue,
} from "@/modules/deals/projects/ProjectTasksCalendar";
import type { LbsDeal, Task as TaskRecord } from "@/modules/types";

export const ProjectTasksPanel = ({
  record,
  contactIds,
}: {
  record: LbsDeal;
  contactIds: LbsDeal["contact_ids"];
}) => {
  const [status, setStatus] = useState<TaskStatusFilter>("open");
  const [dayFilter, setDayFilter] = useState<CalendarFilterValue>(null);
  const taskContactId =
    record.contact_id ??
    (Array.isArray(record.contact_ids) ? record.contact_ids[0] : null) ??
    (contactIds.length > 0 ? contactIds[0] : null);

  const filter = useMemo(
    () => ({ "deal_id@eq": record.id, ...TASK_STATUS_FILTERS[status] }),
    [record.id, status],
  );

  const { data: openTasksForStats = [] } = useGetList<TaskRecord>(
    "tasks",
    {
      filter: { "deal_id@eq": record.id, ...TASK_STATUS_FILTERS.open },
      pagination: { page: 1, perPage: 100 },
      sort: { field: "due_date", order: "ASC" },
    },
    { staleTime: 30_000 },
  );

  const { data: tasks = [], isPending } = useGetList<TaskRecord>(
    "tasks",
    {
      filter,
      pagination: { page: 1, perPage: 100 },
      sort: {
        field: status === "done" ? "done_date" : "due_date",
        order: status === "done" ? "DESC" : "ASC",
      },
    },
    { staleTime: 30_000 },
  );

  const filteredTasks = useMemo(() => {
    if (!dayFilter) return tasks;
    return tasks.filter((task) => {
      const raw =
        (task as { due_date?: string | null; done_date?: string | null })
          .due_date ??
        (task as { done_date?: string | null }).done_date ??
        null;
      if (!raw) return false;
      return toDateKey(raw) === dayFilter.dateKey;
    });
  }, [tasks, dayFilter]);

  if (isPending) return <Skeleton className="h-40 w-full rounded-lg" />;

  return (
    <div className="space-y-3">
      <ProjectTasksCalendar
        tasks={tasks}
        value={dayFilter}
        onChange={setDayFilter}
      />
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
        <div className="flex min-w-0 flex-wrap items-center gap-3">
          <Tabs
            value={status}
            onValueChange={(v) => setStatus(v as TaskStatusFilter)}
          >
            <TabsList className="inline-flex h-auto w-max shrink-0 gap-1 rounded-lg bg-muted p-1">
              <TabsTrigger value="open" className="shrink-0">
                Open
              </TabsTrigger>
              <TabsTrigger value="done" className="shrink-0">
                Done
              </TabsTrigger>
            </TabsList>
          </Tabs>
          <ProjectTaskStats
            stats={computeTaskStats(openTasksForStats)}
            variant="compact"
          />
        </div>
        {taskContactId ? (
          <AddTask
            contactId={contactIds.length === 1 ? taskContactId : undefined}
            contactIds={contactIds.length > 1 ? contactIds : undefined}
            dealId={record.id}
            display="chip"
          />
        ) : (
          <p className="text-sm text-muted-foreground">
            Link a contact to create tasks.
          </p>
        )}
      </div>
      <TaskTable
        tasks={filteredTasks}
        emptyMessage={
          dayFilter
            ? "No tasks on this day."
            : status === "done"
              ? "No completed tasks."
              : "No open tasks."
        }
      />
    </div>
  );
};
