import { useMemo } from "react";
import { useGetList } from "ra-core";
import type { OrganizationMember } from "@/components/atomic-crm/types";
import type { CalendarEvent } from "@/modules/calendar/calendarUtils";
import { collectCalendarEventMemberIds } from "@/modules/calendar/calendarEventAssignees";

export const useCalendarAssigneeMembers = (
  eventsByDate: Record<string, CalendarEvent[]>,
  enabled: boolean,
) => {
  const memberIds = useMemo(
    () => collectCalendarEventMemberIds(eventsByDate),
    [eventsByDate],
  );

  const { data: members = [], isPending } = useGetList<OrganizationMember>(
    "organization_members",
    {
      filter:
        memberIds.length > 0
          ? { "id@in": `(${memberIds.join(",")})` }
          : { "id@eq": -1 },
      pagination: { page: 1, perPage: Math.max(memberIds.length, 1) },
      sort: { field: "id", order: "ASC" },
    },
    { enabled: enabled && memberIds.length > 0, staleTime: 60_000 },
  );

  const membersById = useMemo(
    () =>
      new Map(members.map((member) => [String(member.id), member] as const)),
    [members],
  );

  return { membersById, isPending };
};
