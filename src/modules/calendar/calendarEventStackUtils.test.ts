import { describe, expect, it } from "vitest";
import {
  getEventTimeSlotKey,
  groupEventsByTimeSlot,
  groupTimedBlocksByStart,
  shouldUseTimeSlotOverflow,
  TIME_SLOT_FAN_MAX,
} from "@/modules/calendar/calendarEventStackUtils";
import type { CalendarEvent } from "@/modules/calendar/calendarUtils";

describe("calendarEventStackUtils", () => {
  it("groups events by time slot", () => {
    const events = [
      { kind: "activity", id: "a1", date: "2026-07-21", time: "09:00:00" },
      { kind: "reminder", id: "r1", date: "2026-07-21", time: "09:00:00" },
      { kind: "task", id: "t1", date: "2026-07-21", task: { due_date: "2026-07-21" } },
    ] as CalendarEvent[];

    const groups = groupEventsByTimeSlot(events);
    expect(groups).toHaveLength(2);
    expect(groups[0]).toHaveLength(2);
    expect(groups[1]).toHaveLength(1);
  });

  it("flags overflow when more than three events share a slot", () => {
    expect(shouldUseTimeSlotOverflow(TIME_SLOT_FAN_MAX)).toBe(false);
    expect(shouldUseTimeSlotOverflow(TIME_SLOT_FAN_MAX + 1)).toBe(true);
  });

  it("uses untimed bucket for events without time", () => {
    expect(
      getEventTimeSlotKey({
        kind: "task",
        id: "t1",
        date: "2026-07-21",
        task: {},
      } as CalendarEvent),
    ).toBe("__untimed__");
  });

  it("groups timed blocks by start position", () => {
    const groups = groupTimedBlocksByStart([
      { event: { id: "a" } as CalendarEvent, topPx: 100, heightPx: 40 },
      { event: { id: "b" } as CalendarEvent, topPx: 100, heightPx: 56 },
      { event: { id: "c" } as CalendarEvent, topPx: 200, heightPx: 30 },
    ]);

    expect(groups).toHaveLength(2);
    expect(groups[0]).toHaveLength(2);
    expect(groups[1]).toHaveLength(1);
  });
});
