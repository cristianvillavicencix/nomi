import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { CalendarEventChip } from "@/lbs/calendar/CalendarEventChip";
import {
  addMonths,
  buildTaskCalendarEvent,
  formatDayLabel,
  formatMonthLabel,
  getMonthGridDays,
  getWeekdayLabel,
  isSameDay,
  isSameMonth,
  toDateKey,
  type CalendarEvent,
} from "@/lbs/calendar/calendarUtils";
import {
  getTaskPriorityClassName,
  getTaskPriorityLabel,
  sortTasksByPriorityAndDue,
} from "@/components/atomic-crm/tasks/taskConstants";
import { TaskEdit } from "@/components/atomic-crm/tasks/TaskEdit";
import { TaskDescriptionCell } from "@/components/atomic-crm/tasks/TaskDescriptionCell";
import { useTaskCompletionToggle } from "@/components/atomic-crm/tasks/useTaskCompletionToggle";
import { useTaskParticipantsByTaskIds } from "@/components/atomic-crm/tasks/useTaskParticipants";
import type { Task, TaskParticipant } from "@/components/atomic-crm/types";
import { cn } from "@/lib/utils";

const TasksCompactMonthGrid = ({
  anchor,
  selectedDateKey,
  taskCountByDate,
  onSelectDay,
}: {
  anchor: Date;
  selectedDateKey: string;
  taskCountByDate: Record<string, number>;
  onSelectDay: (dateKey: string) => void;
}) => {
  const days = getMonthGridDays(anchor);
  const today = new Date();
  const headerDays = days.slice(0, 7);

  const weekRows = useMemo(() => {
    const rows: Date[][] = [];
    for (let index = 0; index < days.length; index += 7) {
      rows.push(days.slice(index, index + 7));
    }
    return rows;
  }, [days]);

  return (
    <div className="overflow-hidden rounded-lg border">
      <div className="grid grid-cols-7 border-b bg-muted/40">
        {headerDays.map((day) => (
          <div
            key={toDateKey(day)}
            className="px-1 py-1.5 text-center text-[10px] font-medium text-muted-foreground"
          >
            {getWeekdayLabel(day)}
          </div>
        ))}
      </div>

      <div>
        {weekRows.map((week, weekIndex) => (
          <div key={weekIndex} className="grid grid-cols-7">
            {week.map((day) => {
              const dateKey = toDateKey(day);
              const taskCount = taskCountByDate[dateKey] ?? 0;
              const inMonth = isSameMonth(day, anchor);
              const isToday = isSameDay(day, today);
              const isSelected = dateKey === selectedDateKey;

              return (
                <button
                  key={dateKey}
                  type="button"
                  onClick={() => onSelectDay(dateKey)}
                  className={cn(
                    "flex min-h-9 flex-col items-center justify-center gap-0.5 border-b border-r py-1 text-xs transition-colors hover:bg-muted/40",
                    !inMonth && "text-muted-foreground opacity-60",
                    isSelected &&
                      "bg-primary/10 ring-1 ring-inset ring-primary/30",
                  )}
                >
                  <span
                    className={cn(
                      "inline-flex size-6 items-center justify-center rounded-full",
                      isToday &&
                        "bg-primary text-primary-foreground font-semibold",
                    )}
                  >
                    {day.getDate()}
                  </span>
                  {taskCount > 0 ? (
                    <span className="text-[9px] font-medium text-primary">
                      {taskCount}
                    </span>
                  ) : (
                    <span className="size-1" aria-hidden />
                  )}
                </button>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
};

const TasksDayListItem = ({
  task,
  participants,
}: {
  task: Task;
  participants: TaskParticipant[];
}) => {
  const [editOpen, setEditOpen] = useState(false);
  const calendarEvent = buildTaskCalendarEvent(task);
  const {
    toggle,
    checkboxChecked,
    checkboxDisabled,
    usesParticipantCompletion,
  } = useTaskCompletionToggle(task, participants);

  if (!calendarEvent) return null;

  const isFullyDone = Boolean(task.done_date);
  const isDoneForUser = usesParticipantCompletion
    ? checkboxChecked
    : isFullyDone;

  return (
    <>
      <li className="rounded-md border p-3">
        <div className="flex items-start gap-2">
          <Checkbox
            checked={checkboxChecked}
            disabled={checkboxDisabled}
            onCheckedChange={toggle}
            aria-label={isDoneForUser ? "Mark task open" : "Mark task done"}
            className="mt-0.5"
          />
          <div className="min-w-0 flex-1">
            <button
              type="button"
              className="w-full cursor-pointer text-left"
              onClick={() => setEditOpen(true)}
            >
              <CalendarEventChip event={calendarEvent} static />
              <div className="mt-2">
                <TaskDescriptionCell
                  text={task.text}
                  isDone={isDoneForUser}
                  useMentions
                />
              </div>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <Badge
                  variant="outline"
                  className={getTaskPriorityClassName(task.priority)}
                >
                  {getTaskPriorityLabel(task.priority)}
                </Badge>
                <span className="text-xs text-muted-foreground">
                  Click to edit
                </span>
              </div>
            </button>
          </div>
        </div>
      </li>

      <TaskEdit
        taskId={task.id}
        open={editOpen}
        close={() => setEditOpen(false)}
      />
    </>
  );
};

export const TasksCalendarPanel = ({ tasks }: { tasks: Task[] }) => {
  const [anchor, setAnchor] = useState(() => new Date());
  const [selectedDateKey, setSelectedDateKey] = useState(() =>
    toDateKey(new Date()),
  );

  const eventsByDate = useMemo(() => {
    const map: Record<string, CalendarEvent[]> = {};
    for (const task of tasks) {
      const event = buildTaskCalendarEvent(task);
      if (!event) continue;
      (map[event.date] ??= []).push(event);
    }
    return map;
  }, [tasks]);

  const taskCountByDate = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const [dateKey, events] of Object.entries(eventsByDate)) {
      counts[dateKey] = events.length;
    }
    return counts;
  }, [eventsByDate]);

  const selectedDayTasks = useMemo(() => {
    const dayEvents = eventsByDate[selectedDateKey] ?? [];
    const dayTasks = dayEvents
      .filter(
        (event): event is Extract<CalendarEvent, { kind: "task" }> =>
          event.kind === "task",
      )
      .map((event) => event.task);
    return sortTasksByPriorityAndDue(dayTasks);
  }, [eventsByDate, selectedDateKey]);

  const selectedDayTaskIds = useMemo(
    () => selectedDayTasks.map((task) => task.id),
    [selectedDayTasks],
  );
  const { participantsByTaskId } =
    useTaskParticipantsByTaskIds(selectedDayTaskIds);

  return (
    <aside className="flex h-full min-h-0 flex-col gap-4 rounded-lg border bg-card p-4">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-sm font-semibold">Calendar</h2>
        <div className="flex items-center gap-1">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="size-8"
            onClick={() => setAnchor((current) => addMonths(current, -1))}
            aria-label="Previous month"
          >
            <ChevronLeft className="size-4" />
          </Button>
          <span className="min-w-[88px] text-center text-sm font-medium">
            {formatMonthLabel(anchor)}
          </span>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="size-8"
            onClick={() => setAnchor((current) => addMonths(current, 1))}
            aria-label="Next month"
          >
            <ChevronRight className="size-4" />
          </Button>
        </div>
      </div>

      <TasksCompactMonthGrid
        anchor={anchor}
        selectedDateKey={selectedDateKey}
        taskCountByDate={taskCountByDate}
        onSelectDay={setSelectedDateKey}
      />

      <div className="flex min-h-0 flex-1 flex-col gap-2">
        <h3 className="text-sm font-medium">
          {formatDayLabel(selectedDateKey)}
        </h3>
        {selectedDayTasks.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No tasks due on this day.
          </p>
        ) : (
          <ul className="min-h-0 flex-1 space-y-2 overflow-y-auto pr-1">
            {selectedDayTasks.map((task) => (
              <TasksDayListItem
                key={String(task.id)}
                task={task}
                participants={participantsByTaskId[String(task.id)] ?? []}
              />
            ))}
          </ul>
        )}
      </div>
    </aside>
  );
};
