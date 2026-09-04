import { useMemo, useState } from "react";
import { useGetList } from "ra-core";

import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AddTask } from "@/components/atomic-crm/tasks/AddTask";
import { type TaskStatusFilter } from "@/components/atomic-crm/tasks/taskConstants";
import { TaskTable } from "@/components/atomic-crm/tasks/TaskTable";
import { computeTaskStats } from "@/components/atomic-crm/tasks/taskStats";
import { CalendarMiniMonth } from "@/modules/calendar/CalendarMiniMonth";
import {
  formatDayLabel,
  toDateKey,
} from "@/modules/calendar/calendarUtils";
import { getProjectDeliveryDate } from "@/modules/deals/projectDeliveryDate";
import { ProjectTaskStats } from "@/modules/deals/ProjectTaskStats";
import type { LbsDeal, Task as TaskRecord } from "@/modules/types";

const taskDateKey = (task: TaskRecord) => {
  const raw = task.due_date ?? task.done_date ?? null;
  if (!raw) return null;
  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) return null;
  return toDateKey(date);
};

const toLocalDateKey = (value?: string | null) => {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed;
  const date = new Date(trimmed);
  if (Number.isNaN(date.getTime())) return null;
  return toDateKey(date);
};

export const ProjectTasksPanel = ({
  record,
  contactIds,
}: {
  record: LbsDeal;
  contactIds: LbsDeal["contact_ids"];
}) => {
  const [status, setStatus] = useState<TaskStatusFilter>("open");
  const [anchor, setAnchor] = useState(() => new Date());
  const [selectedDateKey, setSelectedDateKey] = useState<string | null>(null);
  const taskContactId =
    record.contact_id ??
    (Array.isArray(record.contact_ids) ? record.contact_ids[0] : null) ??
    (contactIds.length > 0 ? contactIds[0] : null);

  const { data: allTasks = [], isPending } = useGetList<TaskRecord>(
    "tasks",
    {
      filter: { "deal_id@eq": record.id },
      pagination: { page: 1, perPage: 200 },
      sort: { field: "due_date", order: "ASC" },
    },
    { staleTime: 30_000 },
  );

  const openTasks = useMemo(
    () => allTasks.filter((task) => !task.done_date),
    [allTasks],
  );

  const rangeStartDateKey = useMemo(
    () =>
      toLocalDateKey(record.project_start_date) ??
      toLocalDateKey(record.created_at),
    [record.created_at, record.project_start_date],
  );

  // Same source as the project header countdown (expected end / closing).
  const deliveryDateKey = useMemo(
    () => toLocalDateKey(getProjectDeliveryDate(record)),
    [record],
  );

  // Official delivery is the hard cap; do not stretch past it with task dues.
  const rangeEndDateKey = deliveryDateKey;

  const dotsByDate = useMemo(() => {
    const map: Record<string, string[]> = {};
    for (const task of allTasks) {
      const key = taskDateKey(task);
      if (!key) continue;
      const dots = map[key] ?? [];
      if (dots.length < 3) {
        dots.push(task.done_date ? "bg-muted-foreground/50" : "bg-sky-700");
      }
      map[key] = dots;
    }
    return map;
  }, [allTasks]);

  const listTasks = useMemo(() => {
    const byStatus =
      status === "done"
        ? [...allTasks]
            .filter((task) => Boolean(task.done_date))
            .sort((a, b) => {
              const aDone = a.done_date ? new Date(a.done_date).getTime() : 0;
              const bDone = b.done_date ? new Date(b.done_date).getTime() : 0;
              return bDone - aDone;
            })
        : openTasks;

    if (!selectedDateKey) return byStatus;
    return byStatus.filter((task) => taskDateKey(task) === selectedDateKey);
  }, [allTasks, openTasks, selectedDateKey, status]);

  if (isPending) return <Skeleton className="h-40 w-full rounded-lg" />;

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,18rem)_minmax(0,1fr)] lg:items-start">
      <div className="min-w-0">
        <CalendarMiniMonth
          anchor={anchor}
          selectedDateKey={selectedDateKey ?? ""}
          dotsByDate={dotsByDate}
          rangeStartDateKey={rangeStartDateKey}
          rangeEndDateKey={rangeEndDateKey}
          onAnchorChange={setAnchor}
          onSelectDay={(dateKey) => {
            setSelectedDateKey((current) =>
              current === dateKey ? null : dateKey,
            );
          }}
        />
        {rangeStartDateKey && rangeEndDateKey ? (
          <div className="mt-2 space-y-1.5">
            <div
              className="h-1.5 overflow-hidden rounded-full"
              style={{
                background:
                  "linear-gradient(90deg, hsl(198 82% 48% / 0.35), hsl(38 82% 48% / 0.55))",
              }}
              aria-hidden
            />
            <p className="text-xs text-muted-foreground">
              Start {formatDayLabel(rangeStartDateKey)}
              {" → "}
              Delivery {formatDayLabel(rangeEndDateKey)}
            </p>
          </div>
        ) : null}
        {selectedDateKey ? (
          <div className="mt-2 flex items-center justify-between gap-2">
            <span className="text-xs text-muted-foreground">
              Showing {formatDayLabel(selectedDateKey)}
            </span>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-7 px-2 text-xs"
              onClick={() => setSelectedDateKey(null)}
            >
              Clear
            </Button>
          </div>
        ) : null}
      </div>

      <div className="min-w-0 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
          <div className="flex items-center gap-2.5">
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
              stats={computeTaskStats(openTasks)}
              variant="compact"
            />
          </div>
          {taskContactId ? (
            <AddTask
              contactId={contactIds.length === 1 ? taskContactId : undefined}
              contactIds={contactIds.length > 1 ? contactIds : undefined}
              dealId={record.id}
              dueDate={selectedDateKey ?? undefined}
              display="chip"
            />
          ) : (
            <p className="text-sm text-muted-foreground">
              Link a contact to create tasks.
            </p>
          )}
        </div>

        <TaskTable
          tasks={listTasks}
          status={status}
          emptyMessage={
            selectedDateKey
              ? "No tasks on this day."
              : status === "done"
                ? "No completed tasks."
                : "No open tasks."
          }
        />
      </div>
    </div>
  );
};
