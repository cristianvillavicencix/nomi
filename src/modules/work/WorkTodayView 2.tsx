import { useMemo } from "react";
import { Checkbox } from "@/components/ui/checkbox";
import { TaskDescriptionCell } from "@/components/atomic-crm/tasks/TaskDescriptionCell";
import { useTaskCompletionToggle } from "@/components/atomic-crm/tasks/useTaskCompletionToggle";
import type { Task, TaskParticipant } from "@/components/atomic-crm/types";
import { formatEventTimeRange } from "@/modules/calendar/calendarReminderOptions";
import {
  getEventClassName,
  getEventLabel,
  isCalendarEntryEvent,
  toDateKey,
  type CalendarEvent,
} from "@/modules/calendar/calendarUtils";
import type { WorkItem } from "@/modules/work/workTypes";
import { cn } from "@/lib/utils";

const HOUR_SLOTS = [9, 10, 11, 12, 14, 16];

const parseHour = (time?: string | null) => {
  if (!time) return null;
  const [hours] = time.split(":");
  const value = Number(hours);
  return Number.isFinite(value) ? value : null;
};

const WorkTodayTaskRow = ({
  task,
  participants,
  onSelect,
}: {
  task: Task;
  participants: TaskParticipant[];
  onSelect: () => void;
}) => {
  const { toggle, checkboxChecked, checkboxDisabled, isPending } =
    useTaskCompletionToggle(task, participants);

  return (
    <div className="flex items-center gap-2 rounded-sm border bg-card px-3 py-2">
      <Checkbox
        checked={checkboxChecked}
        disabled={checkboxDisabled || isPending}
        onCheckedChange={() => toggle()}
        aria-label="Mark task complete"
      />
      <button
        type="button"
        onClick={onSelect}
        className="flex min-w-0 flex-1 items-center gap-2.5 text-left"
      >
        <span className="inline-flex shrink-0 rounded-sm border border-border bg-muted px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-foreground">
          Task
        </span>
        <span className="min-w-0 flex-1 truncate text-sm">
          <TaskDescriptionCell
            text={task.text}
            isDone={Boolean(task.done_date)}
            enablePreview={false}
            fadeSurface="card"
          />
        </span>
      </button>
    </div>
  );
};

export const WorkTodayView = ({
  eventsByDate,
  workItems,
  participantsByTaskId,
  onSelectEvent,
  onSelectTask,
}: {
  eventsByDate: Record<string, CalendarEvent[]>;
  workItems: WorkItem[];
  participantsByTaskId: Record<string, TaskParticipant[]>;
  onSelectEvent: (event: CalendarEvent) => void;
  onSelectTask: (task: Task) => void;
}) => {
  const todayKey = toDateKey(new Date());
  const todayEvents = eventsByDate[todayKey] ?? [];

  const { timedEvents, untimedTasks } = useMemo(() => {
    const timed: CalendarEvent[] = [];

    for (const event of todayEvents) {
      if (event.kind === "task") continue;
      if ("time" in event && event.time) {
        timed.push(event);
      }
    }

    const untimed = workItems.filter(
      (item) =>
        item.date === todayKey &&
        !item.done &&
        item.event.kind === "task" &&
        !item.time,
    );

    return { timedEvents: timed, untimedTasks: untimed };
  }, [todayEvents, todayKey, workItems]);

  const meetings = timedEvents.filter((event) => event.kind === "meeting");
  const activities = timedEvents.filter((event) => event.kind === "activity");
  const completedCount = workItems.filter(
    (item) => item.date === todayKey && item.done,
  ).length;
  const totalToday = workItems.filter((item) => item.date === todayKey).length;

  return (
    <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1fr)_320px] xl:items-start">
      <div className="space-y-4 rounded-sm border bg-card p-4">
        <div className="space-y-3">
          {HOUR_SLOTS.map((hour) => {
            const hourEvents = timedEvents.filter(
              (event) =>
                parseHour("time" in event ? event.time : null) === hour,
            );
            return (
              <div
                key={hour}
                className="grid grid-cols-[56px_minmax(0,1fr)] gap-3"
              >
                <span className="pt-1 text-xs tabular-nums text-muted-foreground">
                  {hour}:00
                </span>
                <div className="space-y-2">
                  {hourEvents.map((event) => (
                    <button
                      key={event.id}
                      type="button"
                      onClick={() => onSelectEvent(event)}
                      className={cn(
                        "w-full rounded-sm border px-3 py-2 text-left text-sm",
                        getEventClassName(event),
                      )}
                    >
                      <p className="font-medium">{getEventLabel(event)}</p>
                      {isCalendarEntryEvent(event) ? (
                        <p className="mt-1 text-xs opacity-80">
                          {formatEventTimeRange(
                            event.record.event_time,
                            event.record.duration_minutes,
                          )}
                        </p>
                      ) : null}
                    </button>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <aside className="space-y-4">
        <section className="rounded-sm border bg-card p-4">
          <h3 className="mb-3 text-sm font-semibold">No time · today</h3>
          {untimedTasks.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No unscheduled tasks.
            </p>
          ) : (
            <ul className="space-y-2">
              {untimedTasks.map((item) =>
                item.event.kind === "task" ? (
                  <li key={item.id}>
                    <WorkTodayTaskRow
                      task={item.event.task}
                      participants={
                        participantsByTaskId[String(item.event.task.id)] ?? []
                      }
                      onSelect={() => onSelectTask(item.event.task)}
                    />
                  </li>
                ) : null,
              )}
            </ul>
          )}
        </section>

        <section className="rounded-sm border bg-card p-4">
          <h3 className="mb-3 text-sm font-semibold">Day summary</h3>
          <dl className="space-y-2 text-sm">
            <div className="flex items-center justify-between">
              <dt className="text-muted-foreground">Meetings</dt>
              <dd className="font-medium tabular-nums">{meetings.length}</dd>
            </div>
            <div className="flex items-center justify-between">
              <dt className="text-muted-foreground">Tasks</dt>
              <dd className="font-medium tabular-nums">{totalToday}</dd>
            </div>
            <div className="flex items-center justify-between">
              <dt className="text-muted-foreground">Completed</dt>
              <dd className="font-medium tabular-nums">
                {completedCount} / {totalToday}
              </dd>
            </div>
            {activities.length > 0 ? (
              <div className="flex items-center justify-between">
                <dt className="text-muted-foreground">Activities</dt>
                <dd className="font-medium tabular-nums">
                  {activities.length}
                </dd>
              </div>
            ) : null}
          </dl>
        </section>
      </aside>
    </div>
  );
};
