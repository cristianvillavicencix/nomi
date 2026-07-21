import { describe, expect, it } from "vitest";
import {
  calendarEventInvolvesMember,
  getCalendarEventMemberIds,
} from "@/modules/calendar/calendarEventAssignees";
import type { CalendarEvent } from "@/modules/calendar/calendarUtils";

describe("calendarEventAssignees", () => {
  it("collects task assignees and collaborators", () => {
    const event = {
      kind: "task",
      id: "task-1",
      date: "2026-07-21",
      task: {
        id: 1,
        assignee_person_ids: [10, 11],
        collaborator_person_ids: [12],
        organization_member_id: 99,
      },
    } as CalendarEvent;

    expect(getCalendarEventMemberIds(event)).toEqual([10, 11, 12]);
    expect(calendarEventInvolvesMember(event, 11)).toBe(true);
    expect(calendarEventInvolvesMember(event, 99)).toBe(false);
  });

  it("falls back to task owner when no assignees are set", () => {
    const event = {
      kind: "task",
      id: "task-2",
      date: "2026-07-21",
      task: {
        id: 2,
        organization_member_id: 42,
      },
    } as CalendarEvent;

    expect(getCalendarEventMemberIds(event)).toEqual([42]);
    expect(calendarEventInvolvesMember(event, 42)).toBe(true);
  });

  it("matches calendar entry owner", () => {
    const event = {
      kind: "meeting",
      id: "meeting-1",
      date: "2026-07-21",
      record: {
        id: 5,
        organization_member_id: 7,
        assignee_member_ids: [7, 8],
      },
    } as CalendarEvent;

    expect(calendarEventInvolvesMember(event, 8)).toBe(true);
    expect(calendarEventInvolvesMember(event, 7)).toBe(true);
  });
});
