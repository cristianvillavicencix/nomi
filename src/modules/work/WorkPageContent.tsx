import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router";
import {
  CheckCheck,
  ChevronLeft,
  ChevronRight,
  Plus,
  SlidersHorizontal,
} from "lucide-react";
import { useGetList, type Identifier } from "ra-core";
import type { Deal, OrganizationMember } from "@/components/atomic-crm/types";
import { getMemberName } from "@/components/atomic-crm/tasks/taskMemberOptions";
import {
  ModuleSearchField,
  ModuleToolbar,
  ModuleToolbarActions,
} from "@/components/atomic-crm/layout/ModuleToolbar";
import { TaskEdit } from "@/components/atomic-crm/tasks/TaskEdit";
import { TaskEditSheet } from "@/components/atomic-crm/tasks/TaskEditSheet";
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
import { CalendarDayPanel } from "@/modules/calendar/CalendarDayPanel";
import { CalendarEventSheet } from "@/modules/calendar/CalendarEventSheet";
import { CalendarKpiStrip } from "@/modules/calendar/CalendarKpiStrip";
import {
  buildCategoryDotsByDate,
  CalendarMiniMonth,
} from "@/modules/calendar/CalendarMiniMonth";
import { CalendarUpcomingPanel } from "@/modules/calendar/CalendarUpcomingPanel";
import {
  addDays,
  addMonths,
  formatMonthLabel,
  formatWeekLabel,
  groupEventsByDate,
  isCalendarEntryEvent,
  parseDateKey,
  toDateKey,
  type CalendarEntryEvent,
  type CalendarEvent,
  type CalendarView,
} from "@/modules/calendar/calendarUtils";
import { useCalendarBusinessHours } from "@/modules/calendar/useCalendarBusinessHours";
import { useCalendarAssigneeMembers } from "@/modules/calendar/useCalendarAssigneeMembers";
import { useIsMobile } from "@/hooks/use-mobile";
import { useIsAdminLevel } from "@/lib/permissions/useIsAdminLevel";
import { WorkCalendarView } from "@/modules/work/WorkCalendarView";
import { WorkCategoryChips } from "@/modules/work/WorkCategoryChips";
import { WORK_CATEGORY_OPTIONS } from "@/modules/work/workCategoryUtils";
import { groupWorkItems } from "@/modules/work/workCategoryUtils";
import {
  useWorkPreferences,
  workPreferencesHaveActiveFilters,
  type WorkPreferences,
} from "@/modules/work/useWorkPreferences";
import { useWorkPageData } from "@/modules/work/useWorkPageData";
import type { WorkCategory } from "@/modules/work/workTypes";

const ALL_PROJECTS = "all";
const ALL_TEAM_MEMBERS = "all";
const getDealLabel = (deal: Deal) => deal.name?.trim() || `Project #${deal.id}`;

export const WorkPageContent = () => {
  const isMobile = useIsMobile();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { preferences, setPreferences } = useWorkPreferences();
  const [anchor, setAnchor] = useState(() => new Date());
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    const view = searchParams.get("view");
    if (view !== "calendar") {
      const next = new URLSearchParams(searchParams);
      next.set("view", "calendar");
      setSearchParams(next, { replace: true });
    }
    if (preferences.viewMode !== "calendar") {
      setPreferences({ viewMode: "calendar" });
    }
  }, [searchParams, preferences.viewMode, setPreferences, setSearchParams]);

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

  const isAdminLevel = useIsAdminLevel();
  const { membersById } = useCalendarAssigneeMembers(
    filteredEventsByDate,
    true,
  );
  const showAssigneeAvatars = true;

  const filteredGroupedItems = useMemo(
    () =>
      searchQuery.trim()
        ? groupWorkItems(filteredWorkItems, toDateKey(new Date()), {
            includeDone: preferences.status === "done",
          })
        : groupedItems,
    [filteredWorkItems, groupedItems, preferences.status, searchQuery],
  );

  const {
    notifications: unreadTagNotifications,
    total: unreadTaggedCount,
    refetch: refetchTagNotifications,
  } = useUnreadTaskTagNotifications(memberId);
  const { markRead } = useMarkTaskTagNotificationsRead();

  const [dayPanelOpen, setDayPanelOpen] = useState(false);
  const [dayPanelDateKey, setDayPanelDateKey] = useState(() => toDateKey(new Date()));
  const [calendarSelectedDateKey, setCalendarSelectedDateKey] = useState(() =>
    toDateKey(new Date()),
  );
  const [eventSheetOpen, setEventSheetOpen] = useState(false);
  const [eventSheetDateKey, setEventSheetDateKey] = useState(() =>
    toDateKey(new Date()),
  );
  const [eventSheetTime, setEventSheetTime] = useState<string | null>(null);
  const [eventSheetCategory, setEventSheetCategory] =
    useState<WorkCategory>("task");
  const [editEventId, setEditEventId] = useState<Identifier | null>(null);
  const [editEventIsMeeting, setEditEventIsMeeting] = useState(false);
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

  const { data: teamMembers = [], isPending: isTeamMembersPending } =
    useGetList<OrganizationMember>(
      "organization_members",
      {
        pagination: { page: 1, perPage: 200 },
        sort: { field: "first_name", order: "ASC" },
      },
      { enabled: isAdminLevel, staleTime: 60_000 },
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

  const fallbackDisplay = useMemo(
    () => ({
      showSaturday: preferences.showSaturday,
      showSunday: preferences.showSunday,
    }),
    [preferences.showSaturday, preferences.showSunday],
  );
  const { schedule: businessHoursSchedule } =
    useCalendarBusinessHours(fallbackDisplay);

  const displayOptions = businessHoursSchedule.displayOptions;

  const periodLabel = useMemo(
    () =>
      preferences.calendarView === "month"
        ? formatMonthLabel(anchor)
        : formatWeekLabel(anchor),
    [anchor, preferences.calendarView],
  );

  const shiftPeriod = (direction: -1 | 1) => {
    setAnchor((current) =>
      preferences.calendarView === "month"
        ? addMonths(current, direction)
        : addDays(current, direction * 7),
    );
  };

  const openDayPanel = (dateKey: string) => {
    setCalendarSelectedDateKey(dateKey);
    setDayPanelDateKey(dateKey);
    setAnchor(parseDateKey(dateKey));
    setDayPanelOpen(true);
  };

  const closeDayPanel = () => setDayPanelOpen(false);

  const openEventSheet = ({
    dateKey,
    time = null,
    category = "task",
    eventId = null,
    isMeeting = false,
  }: {
    dateKey: string;
    time?: string | null;
    category?: WorkCategory;
    eventId?: Identifier | null;
    isMeeting?: boolean;
  }) => {
    setEventSheetDateKey(dateKey);
    setEventSheetTime(time);
    setEventSheetCategory(category);
    setEditEventId(eventId);
    setEditEventIsMeeting(isMeeting);
    setDayPanelOpen(false);
    setEventSheetOpen(true);
  };

  const closeEventSheet = (nextOpen: boolean) => {
    setEventSheetOpen(nextOpen);
    if (!nextOpen) {
      setEditEventId(null);
      setEditEventIsMeeting(false);
      setEventSheetTime(null);
      setEventSheetCategory("task");
    }
  };

  const handleCalendarSelectDay = (dateKey: string) => {
    openDayPanel(dateKey);
  };

  const openEditReminder = (event: CalendarEntryEvent) => {
    openEventSheet({
      dateKey: event.date,
      eventId: event.record.id,
      isMeeting: Boolean(event.record.meeting_url?.trim()),
    });
  };

  const handleSelectEvent = (event: CalendarEvent) => {
    if (event.kind === "task") {
      setEditTaskId(event.task.id);
      setEditTaskOpen(true);
      setDayPanelOpen(false);
      return;
    }
    if (isCalendarEntryEvent(event)) {
      openEditReminder(event);
      return;
    }
    navigate(`/deals/${event.dealId}/show?tab=overview`);
  };

  const handleEditEvent = (event: CalendarEvent) => {
    handleSelectEvent(event);
  };

  const handleSelectSlot = (dateKey: string, time: string) => {
    const daySchedule = businessHoursSchedule.getDaySchedule(dateKey);
    if (daySchedule.closed) return;
    if (
      businessHoursSchedule.enabled &&
      !businessHoursSchedule.isWithinBusinessHours(dateKey, time)
    ) {
      return;
    }
    openEventSheet({ dateKey, time, category: "activity" });
  };

  const dayPanelEvents = filteredEventsByDate[dayPanelDateKey] ?? [];

  const calendarSidebarEvents =
    filteredEventsByDate[calendarSelectedDateKey] ?? [];

  const categoryDotsByDate = useMemo(
    () =>
      buildCategoryDotsByDate(filteredEventsByDate, (category) =>
        WORK_CATEGORY_OPTIONS.find((entry) => entry.value === category)
          ?.dotClass ?? "bg-muted-foreground/50",
      ),
    [filteredEventsByDate],
  );

  const markAllTaggedRead = async () => {
    await markRead(unreadTagNotifications);
    await refetchTagNotifications();
  };

  const hasAdvancedFilters =
    workPreferencesHaveActiveFilters(preferences) ||
    preferences.status !== "open" ||
    preferences.includeDoneTasks ||
    preferences.includeCompletedReminders ||
    (!businessHoursSchedule.enabled &&
      (!preferences.showSaturday || !preferences.showSunday));

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
        </ModuleToolbarActions>
      </ModuleToolbar>

      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
        <div className="flex min-w-0 flex-wrap items-center gap-3">
          <p className="text-sm text-muted-foreground">{stats.open} open</p>

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
        </div>

        <div className="flex min-w-0 flex-wrap items-center justify-end gap-2">
          <WorkCategoryChips
            selected={preferences.categories}
            onChange={(categories) => setPreferences({ categories })}
            counts={categoryCounts}
          />

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
                    onValueChange={(value) => {
                      const scope = value as TaskScopeFilter;
                      const updates: Partial<WorkPreferences> = { scope };
                      if (
                        scope === "mine" &&
                        preferences.teamMemberId != null &&
                        memberId != null &&
                        String(preferences.teamMemberId) !== String(memberId)
                      ) {
                        updates.teamMemberId = null;
                      }
                      setPreferences(updates);
                    }}
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

                {isAdminLevel ? (
                  <div className="space-y-2">
                    <Label>Team member</Label>
                    <Select
                      value={
                        preferences.teamMemberId != null
                          ? String(preferences.teamMemberId)
                          : ALL_TEAM_MEMBERS
                      }
                      onValueChange={(value) => {
                        const teamMemberId =
                          value === ALL_TEAM_MEMBERS ? null : value;
                        const updates: Partial<WorkPreferences> = {
                          teamMemberId,
                        };
                        if (
                          teamMemberId != null &&
                          memberId != null &&
                          String(teamMemberId) !== String(memberId) &&
                          preferences.scope === "mine"
                        ) {
                          updates.scope = "team";
                        }
                        setPreferences(updates);
                      }}
                      disabled={isTeamMembersPending}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="All members" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value={ALL_TEAM_MEMBERS}>
                          All members
                        </SelectItem>
                        {teamMembers.map((member) => (
                          <SelectItem key={member.id} value={String(member.id)}>
                            {getMemberName(member)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                ) : null}

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

              {businessHoursSchedule.enabled ? (
                <p className="rounded-md border bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
                  Weekend visibility follows business hours from Settings →
                  Connectors → Twilio → Business hours.
                </p>
              ) : (
                <div className="space-y-3">
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
              )}

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
              </div>
            </PopoverContent>
          </Popover>

          <Button
            type="button"
            variant="primary"
            size="sm"
            onClick={() => {
              openEventSheet({ dateKey: toDateKey(new Date()) });
            }}
            aria-label="Add to calendar"
          >
            <Plus className="size-4" />
            Add
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[240px_minmax(0,1fr)] xl:items-start">
        <div className="hidden xl:flex xl:flex-col xl:gap-4">
          <aside className="rounded-lg border bg-card p-4">
            <CalendarMiniMonth
              anchor={anchor}
              selectedDateKey={calendarSelectedDateKey}
              dotsByDate={categoryDotsByDate}
              onSelectDay={handleCalendarSelectDay}
              onAnchorChange={setAnchor}
            />
          </aside>
          <CalendarUpcomingPanel
            selectedDateKey={calendarSelectedDateKey}
            events={calendarSidebarEvents}
            onSelectEvent={handleSelectEvent}
            onAddEvent={(dateKey) => openEventSheet({ dateKey })}
            showAssigneeAvatars={showAssigneeAvatars}
            membersById={membersById}
          />
        </div>

        <div className="relative min-w-0 space-y-3">
          <CalendarKpiStrip
            open={stats.open}
            done={stats.done}
            overdue={stats.overdue}
            dueToday={filteredGroupedItems.today.length}
          />
          <WorkCalendarView
            anchor={anchor}
            view={preferences.calendarView}
            eventsByDate={filteredEventsByDate}
            displayOptions={displayOptions}
            schedule={businessHoursSchedule}
            selectedDateKey={calendarSelectedDateKey}
            onSelectDay={handleCalendarSelectDay}
            onSelectEvent={handleSelectEvent}
            onEditEvent={handleEditEvent}
            onSelectSlot={handleSelectSlot}
            showAssigneeAvatars={showAssigneeAvatars}
            membersById={membersById}
          />
          <CalendarDayPanel
            dateKey={dayPanelDateKey}
            events={dayPanelEvents}
            schedule={businessHoursSchedule}
            open={dayPanelOpen}
            onClose={closeDayPanel}
            onSelectEvent={handleSelectEvent}
            onEditEvent={handleEditEvent}
            onSelectSlot={handleSelectSlot}
            onAddEvent={(dateKey) => openEventSheet({ dateKey })}
            showAssigneeAvatars={showAssigneeAvatars}
            membersById={membersById}
          />
        </div>
      </div>

      <CalendarEventSheet
        open={eventSheetOpen}
        onOpenChange={closeEventSheet}
        dateKey={eventSheetDateKey}
        initialTime={eventSheetTime}
        initialCategory={eventSheetCategory}
        editEventId={editEventId}
        editIsMeeting={editEventIsMeeting}
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
