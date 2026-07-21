import { describe, expect, it } from "vitest";
import {
  computeHourOccupancy,
  getOccupancyBackgroundClass,
} from "@/modules/calendar/calendarOccupancy";
import type { CalendarEvent } from "@/modules/calendar/calendarUtils";

describe("calendarOccupancy", () => {
  it("computes occupied minutes per hour", () => {
    const event = {
      kind: "meeting",
      id: "m1",
      date: "2026-07-21",
      time: "09:30:00",
      record: {
        id: 1,
        event_time: "09:30:00",
        duration_minutes: 60,
      },
    } as CalendarEvent;

    const occupancy = computeHourOccupancy({
      events: [event],
      startHour: 9,
      endHour: 11,
    });

    expect(occupancy[0]?.occupiedMinutes).toBe(30);
    expect(occupancy[1]?.occupiedMinutes).toBe(30);
  });

  it("maps ratio to background classes", () => {
    expect(getOccupancyBackgroundClass(0)).toBe("");
    expect(getOccupancyBackgroundClass(0.2)).toBe("bg-primary/5");
    expect(getOccupancyBackgroundClass(0.8)).toBe("bg-primary/30");
  });
});
