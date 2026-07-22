import { describe, expect, it } from "vitest";
import {
  calendarEventToCreateCategory,
  isScheduledEventCreateCategory,
  isTaskCreateCategory,
  workCategoryToCreateCategory,
} from "@/modules/work/workCreateCategories";
import type { CalendarEvent } from "@/modules/calendar/calendarUtils";

describe("workCreateCategories", () => {
  it("maps filter categories to simplified create options", () => {
    expect(workCategoryToCreateCategory("task")).toBe("task");
    expect(workCategoryToCreateCategory("meeting")).toBe("meeting");
    expect(workCategoryToCreateCategory("activity")).toBe("scheduled_event");
    expect(workCategoryToCreateCategory("follow_up")).toBe("scheduled_event");
    expect(workCategoryToCreateCategory("delivery")).toBe("scheduled_event");
  });

  it("maps calendar events to create categories", () => {
    expect(
      calendarEventToCreateCategory({
        kind: "task",
        id: "task:1",
        date: "2026-06-22",
        title: "Review",
        task: {} as never,
        overdue: false,
        done: false,
      }),
    ).toBe("task");

    expect(
      calendarEventToCreateCategory({
        kind: "reminder",
        id: "reminder:1",
        date: "2026-06-22",
        time: "10:00",
        title: "Call",
        record: {} as never,
        done: false,
      }),
    ).toBe("scheduled_event");
  });

  it("identifies create category helpers", () => {
    expect(isTaskCreateCategory("task")).toBe(true);
    expect(isScheduledEventCreateCategory("scheduled_event")).toBe(true);
  });
});
