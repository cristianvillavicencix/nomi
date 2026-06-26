import { useMemo } from "react";
import { useGetMany } from "ra-core";
import type { Deal } from "@/components/atomic-crm/types";
import { useCurrentOrganizationMember } from "@/components/atomic-crm/tasks/useCurrentOrganizationMember";
import {
  useMyProjectDealIds,
  useScopedTasks,
} from "@/components/atomic-crm/tasks/useScopedTasks";
import {
  buildTaskCalendarEvent,
  toDateKey,
} from "@/modules/calendar/calendarUtils";
import { useCalendarEvents } from "@/modules/calendar/useCalendarEvents";
import { computeTaskStats } from "@/components/atomic-crm/tasks/taskStats";
import {
  calendarEventToWorkItem,
  filterWorkItemsByCategories,
  groupWorkItems,
} from "@/modules/work/workCategoryUtils";
import type { WorkPreferences } from "@/modules/work/useWorkPreferences";

export const useWorkPageData = ({
  preferences,
  anchor,
}: {
  preferences: WorkPreferences;
  anchor: Date;
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

  const {
    eventsByDate,
    events,
    isPending: isEventsPending,
  } = useCalendarEvents({
    anchor,
    view: preferences.viewMode === "today" ? "week" : preferences.calendarView,
    includeDoneTasks: includeDoneForCalendar,
    includeCompletedReminders: preferences.includeCompletedReminders,
    projectId: preferences.projectId,
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

  const { data: deals = [] } = useGetMany<Deal>(
    "deals",
    { ids: dealIds },
    { enabled: dealIds.length > 0, staleTime: 60_000 },
  );

  const dealsById = useMemo(
    () => new Map(deals.map((deal) => [String(deal.id), deal])),
    [deals],
  );

  const workItems = useMemo(() => {
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

    return filterWorkItemsByCategories(items, preferences.categories);
  }, [dealsById, events, preferences.categories, tasks]);

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
    events,
    eventsByDate,
    workItems,
    groupedItems,
    stats,
    isPending,
  };
};
