import { useMemo, useState } from "react";
import { useNavigate } from "react-router";
import { ChevronLeft, ChevronRight, SlidersHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  PageLayout,
  ScrollableContentArea,
  StickyPageHeader,
} from "@/components/atomic-crm/layout/page-shell";
import { ModuleInfoPopover } from "@/components/atomic-crm/layout/ModuleInfoPopover";
import { AddTask } from "@/components/atomic-crm/tasks/AddTask";
import { TaskEdit } from "@/components/atomic-crm/tasks/TaskEdit";
import { TaskEditSheet } from "@/components/atomic-crm/tasks/TaskEditSheet";
import { CalendarDayDialog } from "@/lbs/calendar/CalendarDayDialog";
import { CalendarMonthGrid } from "@/lbs/calendar/CalendarMonthGrid";
import { CalendarProjectFilter } from "@/lbs/calendar/CalendarProjectFilter";
import { CalendarReminderDialog } from "@/lbs/calendar/CalendarReminderDialog";
import { CalendarWeekGrid } from "@/lbs/calendar/CalendarWeekGrid";
import {
  addMonths,
  addDays,
  formatMonthLabel,
  formatWeekLabel,
  isCalendarEntryEvent,
  startOfWeek,
  type CalendarEntryEvent,
  type CalendarEvent,
  type CalendarView,
} from "@/lbs/calendar/calendarUtils";
import { useCalendarEvents } from "@/lbs/calendar/useCalendarEvents";
import { useCalendarPreferences } from "@/lbs/calendar/useCalendarPreferences";
import { DEFAULT_MEETING_DURATION_MINUTES } from "@/lbs/calendar/calendarReminderOptions";
import { useIsMobile } from "@/hooks/use-mobile";

export const CalendarPage = () => {
  const isMobile = useIsMobile();
  const navigate = useNavigate();
  const { preferences, setPreferences } = useCalendarPreferences();
  const {
    view,
    includeDoneTasks,
    includeCompletedReminders,
    showSaturday,
    showSunday,
    projectId,
  } = preferences;
  const [anchor, setAnchor] = useState(() => new Date());
  const [selectedDateKey, setSelectedDateKey] = useState<string | null>(null);
  const [dayDialogOpen, setDayDialogOpen] = useState(false);
  const [createTaskOpen, setCreateTaskOpen] = useState(false);
  const [createTaskDueDate, setCreateTaskDueDate] = useState(() =>
    new Date().toISOString().slice(0, 10),
  );
  const [reminderDialogOpen, setReminderDialogOpen] = useState(false);
  const [reminderDateKey, setReminderDateKey] = useState(() =>
    new Date().toISOString().slice(0, 10),
  );
  const [editReminderId, setEditReminderId] = useState<string | number | null>(
    null,
  );
  const [reminderVariant, setReminderVariant] = useState<"event" | "meeting">(
    "event",
  );
  const [reminderInitialRecord, setReminderInitialRecord] = useState<
    Record<string, unknown> | undefined
  >();
  const [editTaskId, setEditTaskId] = useState<string | number | null>(null);
  const [editTaskOpen, setEditTaskOpen] = useState(false);

  const displayOptions = useMemo(
    () => ({ showSaturday, showSunday }),
    [showSaturday, showSunday],
  );

  const hasActiveFilters =
    includeDoneTasks ||
    includeCompletedReminders ||
    !showSaturday ||
    !showSunday;

  const { eventsByDate, isPending } = useCalendarEvents({
    anchor,
    view,
    includeDoneTasks,
    includeCompletedReminders,
    projectId,
  });

  const periodLabel = useMemo(
    () =>
      view === "month" ? formatMonthLabel(anchor) : formatWeekLabel(anchor),
    [anchor, view],
  );

  const selectedDayEvents = selectedDateKey
    ? (eventsByDate[selectedDateKey] ?? [])
    : [];

  const shiftPeriod = (direction: -1 | 1) => {
    setAnchor((current) =>
      view === "month"
        ? addMonths(current, direction)
        : addDays(current, direction * 7),
    );
  };

  const openDay = (dateKey: string) => {
    setSelectedDateKey(dateKey);
    setDayDialogOpen(true);
  };

  const openCreateTask = (dateKey: string) => {
    setCreateTaskDueDate(dateKey);
    setDayDialogOpen(false);
    setCreateTaskOpen(true);
  };

  const openCreateReminder = (dateKey: string) => {
    setReminderDateKey(dateKey);
    setEditReminderId(null);
    setReminderVariant("event");
    setReminderInitialRecord(undefined);
    setDayDialogOpen(false);
    setReminderDialogOpen(true);
  };

  const openScheduleMeeting = (dateKey: string) => {
    setReminderDateKey(dateKey);
    setEditReminderId(null);
    setReminderVariant("meeting");
    setReminderInitialRecord({
      duration_minutes: DEFAULT_MEETING_DURATION_MINUTES,
      meeting_url: null,
    });
    setDayDialogOpen(false);
    setReminderDialogOpen(true);
  };

  const openEditReminder = (event: CalendarEntryEvent) => {
    setEditReminderId(event.record.id);
    setReminderDateKey(event.date);
    setReminderVariant(event.record.meeting_url?.trim() ? "meeting" : "event");
    setReminderInitialRecord(undefined);
    setDayDialogOpen(false);
    setReminderDialogOpen(true);
  };

  const handleSelectEvent = (event: CalendarEvent) => {
    if (event.kind === "task") {
      setEditTaskId(event.task.id);
      setEditTaskOpen(true);
      setDayDialogOpen(false);
      return;
    }

    if (isCalendarEntryEvent(event)) {
      openEditReminder(event);
      return;
    }

    navigate(`/deals/${event.dealId}/show?tab=overview`);
  };

  return (
    <PageLayout>
      <StickyPageHeader className="pb-2">
        <div className="flex flex-col gap-3 px-4 pt-4 md:px-6">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex shrink-0 items-center gap-1">
              <Button
                type="button"
                variant="outline"
                size="icon"
                className="size-8"
                onClick={() => shiftPeriod(-1)}
              >
                <ChevronLeft className="size-4" />
              </Button>
              <div className="min-w-0 px-1 text-center text-xs font-medium tabular-nums whitespace-nowrap sm:text-sm">
                {periodLabel}
              </div>
              <Button
                type="button"
                variant="outline"
                size="icon"
                className="size-8"
                onClick={() => shiftPeriod(1)}
              >
                <ChevronRight className="size-4" />
              </Button>
            </div>

            <div className="flex flex-wrap items-center justify-end gap-2">
              <CalendarProjectFilter
                value={projectId}
                onChange={(nextProjectId) =>
                  setPreferences({ projectId: nextProjectId })
                }
              />

              <Tabs
                value={view}
                onValueChange={(value) =>
                  setPreferences({ view: value as CalendarView })
                }
              >
                <TabsList>
                  <TabsTrigger value="month">Month</TabsTrigger>
                  <TabsTrigger value="week">Week</TabsTrigger>
                </TabsList>
              </Tabs>

              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="gap-2"
                  >
                    <SlidersHorizontal className="size-4" />
                    Filter
                    {hasActiveFilters ? (
                      <span
                        className="size-2 rounded-full bg-primary"
                        aria-hidden
                      />
                    ) : null}
                  </Button>
                </PopoverTrigger>
                <PopoverContent align="end" className="w-72 space-y-4">
                  <div className="space-y-3">
                    <div className="flex items-center justify-between gap-3">
                      <Label htmlFor="calendar-show-completed-tasks">
                        Show completed tasks
                      </Label>
                      <Switch
                        id="calendar-show-completed-tasks"
                        checked={includeDoneTasks}
                        onCheckedChange={(checked) =>
                          setPreferences({ includeDoneTasks: checked })
                        }
                      />
                    </div>
                    <div className="flex items-center justify-between gap-3">
                      <Label htmlFor="calendar-show-done-events">
                        Show done events
                      </Label>
                      <Switch
                        id="calendar-show-done-events"
                        checked={includeCompletedReminders}
                        onCheckedChange={(checked) =>
                          setPreferences({ includeCompletedReminders: checked })
                        }
                      />
                    </div>
                    <div className="flex items-center justify-between gap-3">
                      <Label htmlFor="calendar-show-saturday">
                        Show Saturday
                      </Label>
                      <Switch
                        id="calendar-show-saturday"
                        checked={showSaturday}
                        onCheckedChange={(checked) =>
                          setPreferences({ showSaturday: checked })
                        }
                      />
                    </div>
                    <div className="flex items-center justify-between gap-3">
                      <Label htmlFor="calendar-show-sunday">Show Sunday</Label>
                      <Switch
                        id="calendar-show-sunday"
                        checked={showSunday}
                        onCheckedChange={(checked) =>
                          setPreferences({ showSunday: checked })
                        }
                      />
                    </div>
                  </div>
                </PopoverContent>
              </Popover>

              <ModuleInfoPopover
                title="Calendar"
                description="Click a day to add a task or event. Use the project filter to focus on one project."
              />
            </div>
          </div>
        </div>
      </StickyPageHeader>

      <ScrollableContentArea className="px-4 pb-6 md:px-6">
        {isPending ? (
          <div className="space-y-3">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-[520px] w-full" />
          </div>
        ) : view === "month" ? (
          <CalendarMonthGrid
            anchor={anchor}
            eventsByDate={eventsByDate}
            displayOptions={displayOptions}
            onSelectDay={openDay}
            onSelectEvent={handleSelectEvent}
          />
        ) : (
          <CalendarWeekGrid
            anchor={startOfWeek(anchor)}
            eventsByDate={eventsByDate}
            displayOptions={displayOptions}
            onSelectDay={openDay}
            onSelectEvent={handleSelectEvent}
          />
        )}
      </ScrollableContentArea>

      <CalendarDayDialog
        dateKey={selectedDateKey}
        events={selectedDayEvents}
        open={dayDialogOpen}
        onOpenChange={setDayDialogOpen}
        onCreateTask={openCreateTask}
        onCreateReminder={openCreateReminder}
        onScheduleMeeting={openScheduleMeeting}
        onEditTask={(event) => handleSelectEvent(event)}
        onEditReminder={openEditReminder}
      />

      <CalendarReminderDialog
        open={reminderDialogOpen}
        onOpenChange={(nextOpen) => {
          setReminderDialogOpen(nextOpen);
          if (!nextOpen) {
            setEditReminderId(null);
            setReminderInitialRecord(undefined);
            setReminderVariant("event");
          }
        }}
        dateKey={reminderDateKey}
        reminderId={editReminderId}
        variant={reminderVariant}
        initialRecord={reminderInitialRecord}
      />

      <AddTask
        display="chip"
        selectContact
        hideTrigger
        open={createTaskOpen}
        onOpenChange={setCreateTaskOpen}
        dueDate={createTaskDueDate}
      />

      {editTaskId != null ? (
        isMobile ? (
          <TaskEditSheet
            taskId={editTaskId}
            open={editTaskOpen}
            onOpenChange={setEditTaskOpen}
          />
        ) : (
          <TaskEdit
            taskId={editTaskId}
            open={editTaskOpen}
            close={() => setEditTaskOpen(false)}
          />
        )
      ) : null}
    </PageLayout>
  );
};
