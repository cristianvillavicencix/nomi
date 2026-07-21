import type { CalendarEvent } from "@/modules/calendar/calendarUtils";
import { isCalendarEntryEvent } from "@/modules/calendar/calendarUtils";
import type { Identifier } from "ra-core";

const toMemberIds = (value: unknown): number[] => {
  if (!Array.isArray(value)) return [];
  return value.map(Number).filter(Number.isFinite);
};

export const getCalendarEventMemberIds = (event: CalendarEvent): number[] => {
  if (event.kind === "task") {
    const ids = new Set<number>([
      ...toMemberIds(event.task.assignee_person_ids),
      ...toMemberIds(event.task.collaborator_person_ids),
    ]);
    const ownerId = Number(event.task.organization_member_id);
    if (ids.size === 0 && Number.isFinite(ownerId)) {
      ids.add(ownerId);
    }
    return Array.from(ids);
  }

  if (isCalendarEntryEvent(event)) {
    const memberId = Number(event.record.organization_member_id);
    return Number.isFinite(memberId) ? [memberId] : [];
  }

  return [];
};

export const collectCalendarEventMemberIds = (
  eventsByDate: Record<string, CalendarEvent[]>,
) => {
  const ids = new Set<number>();
  for (const events of Object.values(eventsByDate)) {
    for (const event of events) {
      for (const memberId of getCalendarEventMemberIds(event)) {
        ids.add(memberId);
      }
    }
  }
  return Array.from(ids);
};

export const calendarEventInvolvesMember = (
  event: CalendarEvent,
  memberId: Identifier,
) => {
  const memberKey = String(memberId);
  return getCalendarEventMemberIds(event).some(
    (id) => String(id) === memberKey,
  );
};
