import { describe, expect, it } from "vitest";
import type { CalendarEventRecord, Task } from "@/components/atomic-crm/types";
import {
  buildCalendarEventReschedulePayload,
  buildTaskRescheduleDueDate,
  canRescheduleCalendarEvent,
  getCalendarDayDropId,
  getCalendarEventDragId,
  getCalendarSlotDropId,
  getRescheduleSuccessMessage,
  hasRescheduleTargetChanged,
  parseCalendarDayDropId,
  parseCalendarDropTarget,
  parseCalendarSlotDropId,
} from "@/modules/calendar/calendarEventReschedule";

describe("calendarEventReschedule", () => {
  it("allows tasks and calendar entries but not deal milestones", () => {
    expect(
      canRescheduleCalendarEvent({
        kind: "task",
        id: "task-1",
        date: "2026-07-21",
        title: "Call",
        task: { id: 1 } as Task,
        overdue: false,
        done: false,
      }),
    ).toBe(true);

    expect(
      canRescheduleCalendarEvent({
        kind: "meeting",
        id: "ev-1",
        date: "2026-07-21",
        title: "Sync",
        record: { id: 1 } as CalendarEventRecord,
        done: false,
      }),
    ).toBe(true);

    expect(
      canRescheduleCalendarEvent({
        kind: "project_delivery",
        id: "deal-1-delivery",
        date: "2026-07-21",
        title: "Launch",
        dealId: 1,
        dealName: "Acme",
      }),
    ).toBe(false);
  });

  it("builds task due_date preserving time when target time is omitted", () => {
    const due = buildTaskRescheduleDueDate(
      {
        id: 1,
        due_date: "2026-07-21T14:30:00.000Z",
      } as Task,
      "2026-07-24",
    );
    expect(due.startsWith("2026-07-24")).toBe(true);
    expect(due).not.toBe("2026-07-24T00:00:00.000Z");
  });

  it("builds task due_date with an explicit target time", () => {
    const due = buildTaskRescheduleDueDate(
      { id: 1, due_date: "2026-07-21T14:30:00.000Z" } as Task,
      "2026-07-24",
      "09:00:00",
    );
    expect(due.startsWith("2026-07-24")).toBe(true);
    expect(new Date(due).getHours()).toBe(9);
  });

  it("builds calendar event payload with optional target time", () => {
    const payload = buildCalendarEventReschedulePayload(
      {
        id: 1,
        event_date: "2026-07-21",
        event_time: "10:00:00",
      } as CalendarEventRecord,
      "2026-07-24",
      "09:00:00",
    );
    expect(payload.event_date).toBe("2026-07-24");
    expect(payload.event_time).toBe("09:00:00");
  });

  it("encodes drag and drop ids", () => {
    expect(getCalendarEventDragId({ id: "abc" } as never)).toBe(
      "calendar-event:abc",
    );
    expect(getCalendarDayDropId("2026-07-21")).toBe("calendar-day:2026-07-21");
    expect(getCalendarSlotDropId("2026-07-21", "09:00:00")).toBe(
      "calendar-slot:2026-07-21:09:00:00",
    );
    expect(parseCalendarDayDropId("calendar-day:2026-07-21")).toBe(
      "2026-07-21",
    );
    expect(parseCalendarSlotDropId("calendar-slot:2026-07-21:09:00:00")).toEqual(
      { dateKey: "2026-07-21", time: "09:00:00" },
    );
    expect(parseCalendarDropTarget("calendar-day:2026-07-21")).toEqual({
      dateKey: "2026-07-21",
      time: undefined,
    });
  });

  it("detects when a reschedule target changed", () => {
    const event = {
      kind: "meeting" as const,
      id: "ev-1",
      date: "2026-07-21",
      time: "10:00:00",
      title: "Sync",
      record: {
        id: 1,
        event_date: "2026-07-21",
        event_time: "10:00:00",
      } as CalendarEventRecord,
      done: false,
    };

    expect(hasRescheduleTargetChanged(event, "2026-07-21")).toBe(false);
    expect(hasRescheduleTargetChanged(event, "2026-07-22")).toBe(true);
    expect(
      hasRescheduleTargetChanged(event, "2026-07-21", "09:00:00"),
    ).toBe(true);
    expect(
      hasRescheduleTargetChanged(event, "2026-07-21", "10:00:00"),
    ).toBe(false);
  });

  it("formats success messages with optional time", () => {
    const event = {
      kind: "task" as const,
      id: "task-1",
      date: "2026-07-21",
      title: "Call",
      task: { id: 1, due_date: "2026-07-21T09:00:00.000Z" } as Task,
      overdue: false,
      done: false,
    };

    expect(getRescheduleSuccessMessage(event, "2026-07-24")).toMatch(
      /Task moved to .* at \d{2}:\d{2}/,
    );
    expect(
      getRescheduleSuccessMessage(event, "2026-07-24", "14:00:00"),
    ).toMatch(/Task moved to .* at 14:00/);
  });
});
