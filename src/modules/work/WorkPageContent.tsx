import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router";
import {
  CalendarDays,
  CheckCheck,
  ChevronLeft,
  ChevronRight,
  List,
  Plus,
  SlidersHorizontal,
  Sun,
} from "lucide-react";
import { useGetList } from "ra-core";
import type { Deal } from "@/components/atomic-crm/types";
import { AddWorkDialog } from "@/modules/work/AddWorkDialog";
import {
  ModuleSearchField,
  ModuleToolbar,
  ModuleToolbarActions,
} from "@/components/atomic-crm/layout/ModuleToolbar";
import { TaskEdit } from "@/components/atomic-crm/tasks/TaskEdit";
import { TaskEditSheet } from "@/components/atomic-crm/tasks/TaskEditSheet";
import { useTaskParticipantsByTaskIds } from "@/components/atomic-crm/tasks/useTaskParticipants";
import {
  useMarkTaskTagNotificationsRead,
  useUnreadTaskTagNotifications,
} from "@/components/atomic-crm/tasks/useTaskTagNotifications";
import type { TaskScopeFilter } from "@/components/atomic-crm/tasks/scopedTasks";
import { Button } from "@/components/ui/button";
import { IconButton } from "@/components/ui/icon-button";
import { Label } from "@/components/ui/label";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { CalendarDayDialog } from "@/modules/calendar/CalendarDayDialog";
import { CalendarReminderDialog } from "@/modules/calendar/CalendarReminderDialog";
import { DEFAULT_MEETING_DURATION_MINUTES } from "@/modules/calendar/calendarReminderOptions";
import {
  addDays,
  addMonths,
  formatMonthLabel,
  formatWeekLabel,
  groupEventsByDate,
  isCalendarEntryEvent,
  toDateKey,
  type CalendarEntryEvent,
  type CalendarEvent,
  type CalendarView,
} from "@/modules/calendar/calendarUtils";
import { useIsMobile } from "@/hooks/use-mobile";
import { WorkCalendarView } from "@/modules/work/WorkCalendarView";
import { WorkCategoryChips } from "@/modules/work/WorkCategoryChips";
import { groupWorkItems } from "@/modules/work/workCategoryUtils";
import { WorkListView } from "@/modules/work/WorkListView";
import { WorkSidebarPanel } from "@/modules/work/WorkSidebarPanel";
import { WorkTodayView } from "@/modules/work/WorkTodayView";
import {
  useWorkPreferences,
  workPreferencesHaveActiveFilters,
  type WorkPreferences,
} from "@/modules/work/useWorkPreferences";
import { useWorkPageData } from "@/modules/work/useWorkPageData";
import type { WorkItem, WorkViewMode } from "@/modules/work/workTypes";

const ALL_PROJECTS = "all";
const getDealLabel = (deal: Deal) => deal.name?.trim() || `Project #${deal.id}`;

const parseViewMode = (value: string | null): WorkViewMode => {
  if (value === "calendar" || value === "today") return value;
  return "list";
};

export const WorkPageContent = () => {
  const isMobile = useIsMobile();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { preferences, setPreferences } = useWorkPreferences();
  const [anchor, setAnchor] = useState(() => new Date());
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    const view = parseViewMode(searchParams.get("view"));
    if (view !== preferences.viewMode) {
      setPreferences({ viewMode: view });
    }
  }, [searchParams, preferences.viewMode, setPreferences]);

  const setViewMode = (viewMode: WorkViewMode) => {
    setPreferences({ viewMode });
    const next = new URLSearchParams(searchParams);
    if (viewMode === "list") {
      next.delete("view");
    } else {
      next.set("view", viewMode);
    }
    setSearchParams(next, { replace: true });
  };

  const {
    memberId,
    eventsByDate,
    workItems,
    categoryCounts,
    groupedItems,
    stats,
    isPending,
  } = useWorkPageData({ preferences, anchor });

  const filteredWorkItems = useMemo(() => {
    const trimmed = searchQuery.trim().toLowerCase();
    if (!trimmed) return workItems;
    return workItems.filter((item) => {
      const haystack = [item.title, item.dealName]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return haystack.includes(trimmed);
    });
  }, [workItems, searchQuery]);

  const filteredEventsByDate = useMemo(
    () =>
      searchQuery.trim()
        ? groupEventsByDate(filteredWorkItems.map((item) => item.event))
        : eventsByDate,
    [eventsByDate, filteredWorkItems, searchQuery],
  );

  const filteredGroupedItems = useMemo(
    () =>
      searchQuery.trim()
        ? groupWorkItems(filteredWorkItems, toDateKey(new Date()), {
            includeDone: preferences.status === "done",
          })
        : groupedItems,
    [filteredWorkItems, groupedItems, preferences.status, searchQuery],
  );

  const taskIds = useMemo(
    () =>
      filteredWorkItems
        .filter((item) => item.event.kind === "task")
        .map((item) => item.event.task.id),
    [filteredWorkItems],
  );
  const { participantsByTaskId } = useTaskParticipantsByTaskIds(taskIds);

  const {
    notifications: unreadTagNotifications,
    total: unreadTaggedCount,
    refetch: refetchTagNotifications,
  } = useUnreadTaskTagNotifications(memberId);
  const { markRead } = useMarkTaskTagNotificationsRead();

  const [selectedDateKey, setSelectedDateKey] = useState<string | null>(null);
  const [dayDialogOpen, setDayDialogOpen] = useState(false);
  const [createTaskOpen, setCreateTaskOpen] = useState(false);
  const [createTaskDueDate, setCreateTaskDueDate] = useState(() =>
    toDateKey(new Date()),
  );
  const [reminderDialogOpen, setReminderDialogOpen] = useState(false);
  const [reminderDateKey, setReminderDateKey] = useState(() =>
    toDateKey(new Date()),
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

  const { data: deals = [], isPending: isDealsPending } = useGetList<Deal>(
    "deals",
    {
      pagination: { page: 1, perPage: 500 },
      sort: { field: "name", order: "ASC" },
    },
    { staleTime: 60_000 },
  );

  const scopeOptions = useMemo(() => {
    const taggedLabel =
      unreadTaggedCount > 0 ? `Tagged me (${unreadTaggedCount})` : "Tagged me";
    return [
      { value: "mine" as const, label: "My tasks" },
      { value: "tagged" as const, label: taggedLabel },
      { value: "team" as const, label: "All team" },
      { value: "my_projects" as const, label: "My projects" },
    ];
  }, [unreadTaggedCount]);

  const displayOptions = useMemo(
    () => ({
      showSaturday: preferences.showSaturday,
      showSunday: preferences.showSunday,
    }),
    [preferences.showSaturday, preferences.showSunday],
  );

  const periodLabel = useMemo(() => {
    if (preferences.viewMode === "today") {
      return new Date().toLocaleDateString("en-US", {
        weekday: "long",
        day: "numeric",
        month: "short",
      });
    }
    return preferences.calendarView === "month"
      ? formatMonthLabel(anchor)
      : formatWeekLabel(anchor);
  }, [anchor, preferences.calendarView, preferences.viewMode]);

  const shiftPeriod = (direction: -1 | 1) => {
    setAnchor((current) =>
      preferences.calendarView === "month"
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

  const handleSelectWorkItem = (item: WorkItem) => {
    handleSelectEvent(item.event);
  };

  const emptyMessage = useMemo(() => {
    if (preferences.scope === "tagged") {
      return unreadTaggedCount === 0
        ? "No unread @ mentions."
        : preferences.status === "done"
          ? "No completed tasks in your unread mentions."
          : "No open items in your unread mentions.";
    }
    return preferences.status === "done"
      ? "No completed items match these filters."
      : "Nothing on your calendar matches these filters.";
  }, [preferences.scope, preferences.status, unreadTaggedCount]);

  const markAllTaggedRead = async () => {
    await markRead(unreadTagNotifications);
    await refetchTagNotifications();
  };

  const selectedDayEvents = selectedDateKey
    ? (filteredEventsByDate[selectedDateKey] ?? [])
    : [];

  const hasAdvancedFilters =
    workPreferencesHaveActiveFilters(preferences) ||
    preferences.status !== "open" ||
    preferences.includeDoneTasks ||
    preferences.includeCompletedReminders ||
    !preferences.showSaturday ||
    !preferences.showSunday;

  if (isPending) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-[420px] w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <ModuleToolbar className="shrink-0">
        <ModuleSearchField
          value={searchQuery}
          onChange={setSearchQuery}
          basePlaceholder="Search tasks, meetings, or projects"
          total={filteredWorkItems.length}
          itemSingular="item"
        />
        <ModuleToolbarActions>
          <ToggleGroup
            type="single"
            value={preferences.viewMode}
            onValueChange={(value) => {
              if (value === "list" || value === "calendar" || value === "today") {
                setViewMode(value);
              }
            }}
            variant="outline"
            size="sm"
            className="w-fit shrink-0"
          >
            <ToggleGroupItem value="list" aria-label="List view">
              <List className="size-4" />
              List
            </ToggleGroupItem>
            <ToggleGroupItem value="calendar" aria-label="Calendar view">
              <CalendarDays className="size-4" />
              Calendar
            </ToggleGroupItem>
            <ToggleGroupItem value="today" aria-label="Today view">
              <Sun className="size-4" />
              Today
            </ToggleGroupItem>
          </ToggleGroup>

          {preferences.scope === "tagged" &&
          unreadTagNotifications.length > 0 ? (
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={markAllTaggedRead}
            >
              <CheckCheck className="size-4" />
              Mark all read
            </Button>
          ) : null}

          <Popover>
            <PopoverTrigger asChild>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                className="relative shrink-0"
              >
                <SlidersHorizontal className="size-4" />
                Filters
                {hasAdvancedFilters ? (
                  <span
                    className="absolute -right-0.5 -top-0.5 size-2 rounded-full bg-primary"
                    aria-hidden
                  />
                ) : null}
              </Button>
            </PopoverTrigger>
            <PopoverContent align="end" className="w-72 space-y-4">
              <div className="space-y-3">
                <div className="space-y-2">
                  <Label>Project</Label>
                  <Select
                    value={
                      preferences.projectId != null
                        ? String(preferences.projectId)
                        : ALL_PROJECTS
                    }
                    onValueChange={(value) =>
                      setPreferences({
                        projectId: value === ALL_PROJECTS ? null : value,
                      })
                    }
                    disabled={isDealsPending}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="All projects" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={ALL_PROJECTS}>All projects</SelectItem>
                      {deals.map((deal) => (
                        <SelectItem key={deal.id} value={String(deal.id)}>
                          {getDealLabel(deal)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Scope</Label>
                  <Select
                    value={preferences.scope}
                    onValueChange={(value) =>
                      setPreferences({ scope: value as TaskScopeFilter })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {scopeOptions.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Status</Label>
                  <Select
                    value={preferences.status}
                    onValueChange={(value) =>
                      setPreferences({
                        status: value as WorkPreferences["status"],
                      })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="open">Open</SelectItem>
                      <SelectItem value="done">Done</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {preferences.viewMode === "calendar" ? (
                <div className="space-y-2">
                  <Label>Calendar layout</Label>
                  <Select
                    value={preferences.calendarView}
                    onValueChange={(value) =>
                      setPreferences({ calendarView: value as CalendarView })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="month">Month</SelectItem>
                      <SelectItem value="week">Week</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              ) : null}
              <div className="space-y-3">
                <div className="flex items-center justify-between gap-3">
                  <Label htmlFor="work-show-completed-tasks">
                    Show completed tasks
                  </Label>
                  <Switch
                    id="work-show-completed-tasks"
                    checked={preferences.includeDoneTasks}
                    onCheckedChange={(checked) =>
                      setPreferences({ includeDoneTasks: checked })
                    }
                  />
                </div>
                <div className="flex items-center justify-between gap-3">
                  <Label htmlFor="work-show-done-events">
                    Show done events
                  </Label>
                  <Switch
                    id="work-show-done-events"
                    checked={preferences.includeCompletedReminders}
                    onCheckedChange={(checked) =>
                      setPreferences({
                        includeCompletedReminders: checked,
                      })
                    }
                  />
                </div>
                <div className="flex items-center justify-between gap-3">
                  <Label htmlFor="work-show-saturday">Show Saturday</Label>
                  <Switch
                    id="work-show-saturday"
                    checked={preferences.showSaturday}
                    onCheckedChange={(checked) =>
                      setPreferences({ showSaturday: checked })
                    }
                  />
                </div>
                <div className="flex items-center justify-between gap-3">
                  <Label htmlFor="work-show-sunday">Show Sunday</Label>
                  <Switch
                    id="work-show-sunday"
                    checked={preferences.showSunday}
                    onCheckedChange={(checked) =>
                      setPreferences({ showSunday: checked })
                    }
                  />
                </div>
              </div>
            </PopoverContent>
          </Popover>

          <Button
            type="button"
            variant="primary"
            size="sm"
            onClick={() => {
              setCreateTaskDueDate(toDateKey(new Date()));
              setCreateTaskOpen(true);
            }}
            aria-label="Add to calendar"
          >
            <Plus className="size-4" />
            Add
          </Button>
        </ModuleToolbarActions>
      </ModuleToolbar>

      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
        <div className="flex min-w-0 flex-wrap items-center gap-3">
          <p className="text-sm text-muted-foreground">{stats.open} open</p>

          {preferences.viewMode !== "today" ? (
            <div className="flex items-center gap-1 rounded-sm border bg-background px-1 py-0.5">
              <IconButton
                onClick={() => shiftPeriod(-1)}
                aria-label="Previous period"
              >
                <ChevronLeft className="size-4" />
              </IconButton>
              <span className="min-w-[96px] text-center text-sm font-medium tabular-nums">
                {periodLabel}
              </span>
              <IconButton
                onClick={() => shiftPeriod(1)}
                aria-label="Next period"
              >
                <ChevronRight className="size-4" />
              </IconButton>
            </div>
          ) : (
            <span className="text-sm font-medium">{periodLabel}</span>
          )}
        </div>

        <WorkCategoryChips
          selected={preferences.categories}
          onChange={(categories) => setPreferences({ categories })}
          counts={categoryCounts}
        />
      </div>

      {preferences.viewMode === "list" ? (
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1fr)_360px] xl:items-start">
          <WorkListView
            groupedItems={filteredGroupedItems}
            participantsByTaskId={participantsByTaskId}
            onSelectItem={handleSelectWorkItem}
            emptyMessage={emptyMessage}
            doneMode={preferences.status === "done"}
          />
          <div className="hidden xl:block">
            <WorkSidebarPanel
              anchor={anchor}
              onAnchorChange={setAnchor}
              eventsByDate={filteredEventsByDate}
              groupedCounts={{
                overdue: filteredGroupedItems.overdue.length,
                today: filteredGroupedItems.today.length,
              }}
              onSelectEvent={handleSelectEvent}
            />
          </div>
        </div>
      ) : null}

      {preferences.viewMode === "calendar" ? (
        <WorkCalendarView
          anchor={anchor}
          view={preferences.calendarView}
          eventsByDate={filteredEventsByDate}
          displayOptions={displayOptions}
          onSelectDay={openDay}
          onSelectEvent={handleSelectEvent}
        />
      ) : null}

      {preferences.viewMode === "today" ? (
        <WorkTodayView
          eventsByDate={filteredEventsByDate}
          workItems={filteredWorkItems}
          participantsByTaskId={participantsByTaskId}
          onSelectEvent={handleSelectEvent}
          onSelectTask={(task) => {
            setEditTaskId(task.id);
            setEditTaskOpen(true);
          }}
        />
      ) : null}

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

      <AddWorkDialog
        open={createTaskOpen}
        onOpenChange={setCreateTaskOpen}
        dueDate={createTaskDueDate}
        onScheduleMeeting={openScheduleMeeting}
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
    </div>
  );
};
