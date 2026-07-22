import { useMemo } from "react";
import { useGetMany, type Identifier } from "ra-core";
import type { Contact, Deal } from "@/components/atomic-crm/types";
import { useCurrentOrganizationMember } from "@/components/atomic-crm/tasks/useCurrentOrganizationMember";
import {
  useMyProjectDealIds,
  useScopedTasks,
} from "@/components/atomic-crm/tasks/useScopedTasks";
import {
  buildTaskCalendarEvent,
  groupEventsByDate,
  toDateKey,
  type CalendarEvent,
} from "@/modules/calendar/calendarUtils";
import { calendarEventInvolvesMember } from "@/modules/calendar/calendarEventAssignees";
import { useCalendarEvents } from "@/modules/calendar/useCalendarEvents";
import { computeTaskStats } from "@/components/atomic-crm/tasks/taskStats";
import {
  calendarEventToWorkItem,
  filterWorkItemsByCategories,
  groupWorkItems,
} from "@/modules/work/workCategoryUtils";
import type { WorkPreferences } from "@/modules/work/useWorkPreferences";
import type { WorkCategory } from "@/modules/work/workTypes";

/** Extra months loaded on each side of the visible range while searching. */
export const WORK_SEARCH_RANGE_EXPAND_MONTHS = 3;

const collectContactIds = (events: CalendarEvent[], tasks: { contact_id?: Identifier | null }[]) => {
  const ids = new Set<string>();

  for (const event of events) {
    if ("record" in event && event.record.contact_id != null) {
      ids.add(String(event.record.contact_id));
    }
  }

  for (const task of tasks) {
    if (task.contact_id != null) {
      ids.add(String(task.contact_id));
    }
  }

  return Array.from(ids);
};

export const useWorkPageData = ({
  preferences,
  anchor,
  searchActive = false,
}: {
  preferences: WorkPreferences;
  anchor: Date;
  searchActive?: boolean;
}) => {
  const { memberId, isPending: isMemberPending } =
    useCurrentOrganizationMember();

  const { data: projectDealIds = [], isPending: isProjectsPending } =
    useMyProjectDealIds({
      organizationMemberId: memberId,
      enabled: preferences.scope === "my_projects",
    });

  const includeDoneForCalendar =
    preferences.status === "done" || preferences.includeDoneTasks;

  const { events, isPending: isEventsPending } = useCalendarEvents({
    anchor,
    view: preferences.calendarView,
    includeDoneTasks: includeDoneForCalendar,
    includeCompletedReminders: preferences.includeCompletedReminders,
    projectId: preferences.projectId,
    expandRangeMonths: searchActive ? WORK_SEARCH_RANGE_EXPAND_MONTHS : 0,
  });

  const { data: scopedTasksResult, isPending: isTasksPending } = useScopedTasks(
    {
      scope: preferences.scope,
      organizationMemberId: memberId,
      projectDealIds,
      projectId: preferences.projectId,
      status: preferences.status,
      typeFilter: preferences.typeFilter,
      priorityFilter: preferences.priorityFilter,
      enabled: preferences.scope !== "my_projects" || projectDealIds.length > 0,
    },
  );

  const tasks = scopedTasksResult?.data ?? [];

  const dealIds = useMemo(
    () =>
      Array.from(
        new Set(
          events
            .flatMap((event) => {
              if (event.kind === "task") return event.task.deal_id;
              if (
                event.kind === "project_delivery" ||
                event.kind === "project_start"
              ) {
                return event.dealId;
              }
              if ("record" in event) return event.record.deal_id;
              return null;
            })
            .filter((id) => id != null)
            .map(String),
        ),
      ),
    [events],
  );

  const contactIds = useMemo(
    () => collectContactIds(events, tasks),
    [events, tasks],
  );

  const { data: deals = [] } = useGetMany<Deal>(
    "deals",
    { ids: dealIds },
    { enabled: dealIds.length > 0, staleTime: 60_000 },
  );

  const { data: contacts = [] } = useGetMany<Contact>(
    "contacts",
    { ids: contactIds },
    { enabled: contactIds.length > 0, staleTime: 60_000 },
  );

  const dealsById = useMemo(
    () => new Map(deals.map((deal) => [String(deal.id), deal])),
    [deals],
  );

  const contactsById = useMemo(
    () => new Map(contacts.map((contact) => [String(contact.id), contact])),
    [contacts],
  );

  const allWorkItems = useMemo(() => {
    const taskIdsFromEvents = new Set<string>();
    const items = events.map((event) => {
      if (event.kind === "task") {
        taskIdsFromEvents.add(String(event.task.id));
      }
      const dealId =
        event.kind === "task"
          ? event.task.deal_id
          : event.kind === "project_delivery" || event.kind === "project_start"
            ? event.dealId
            : "record" in event
              ? event.record.deal_id
              : null;
      const deal = dealId != null ? dealsById.get(String(dealId)) : null;
      return calendarEventToWorkItem(event, {
        dealName: deal?.name ?? null,
      });
    });

    for (const task of tasks) {
      if (taskIdsFromEvents.has(String(task.id))) continue;
      const event = buildTaskCalendarEvent(task);
      if (!event) continue;
      const deal =
        task.deal_id != null ? dealsById.get(String(task.deal_id)) : null;
      items.push(
        calendarEventToWorkItem(event, {
          dealName: deal?.name ?? null,
        }),
      );
    }

    return items;
  }, [dealsById, events, tasks]);

  const memberFilteredAllWorkItems = useMemo(() => {
    if (preferences.teamMemberId == null) return allWorkItems;
    return allWorkItems.filter((item) =>
      calendarEventInvolvesMember(item.event, preferences.teamMemberId!),
    );
  }, [allWorkItems, preferences.teamMemberId]);

  const workItems = useMemo(
    () =>
      filterWorkItemsByCategories(
        memberFilteredAllWorkItems,
        preferences.categories,
      ),
    [memberFilteredAllWorkItems, preferences.categories],
  );

  const filteredEvents = useMemo(
    () => workItems.map((item) => item.event),
    [workItems],
  );

  /** Calendar / sidebar / day dialog — same category filter as the list. */
  const eventsByDate = useMemo(
    () => groupEventsByDate(filteredEvents),
    [filteredEvents],
  );

  const categoryCounts = useMemo(() => {
    const counts = {} as Record<WorkCategory, number>;
    for (const item of memberFilteredAllWorkItems) {
      counts[item.category] = (counts[item.category] ?? 0) + 1;
    }
    return counts;
  }, [memberFilteredAllWorkItems]);

  const groupedItems = useMemo(
    () =>
      groupWorkItems(workItems, toDateKey(new Date()), {
        includeDone: preferences.status === "done",
      }),
    [workItems, preferences.status],
  );

  const stats = useMemo(() => computeTaskStats(tasks), [tasks]);

  const isPending =
    isMemberPending ||
    isTasksPending ||
    isEventsPending ||
    (preferences.scope === "my_projects" && isProjectsPending);

  return {
    memberId,
    tasks,
    events: filteredEvents,
    eventsByDate,
    workItems,
    searchableWorkItems: memberFilteredAllWorkItems,
    contactsById,
    categoryCounts,
    groupedItems,
    stats,
    isPending,
  };
};
