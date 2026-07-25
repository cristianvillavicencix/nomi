import { describe, expect, it } from "vitest";
import {
  combineTaskDueDateTime,
  extractTaskDueTime,
} from "@/components/atomic-crm/tasks/taskDueDateTime";

describe("taskDueDateTime", () => {
  it("stores midnight when no time is provided", () => {
    const iso = combineTaskDueDateTime("2026-07-22", null);
    const parsed = new Date(iso);
    expect(parsed.getFullYear()).toBe(2026);
    expect(parsed.getMonth()).toBe(6);
    expect(parsed.getDate()).toBe(22);
    expect(parsed.getHours()).toBe(0);
    expect(parsed.getMinutes()).toBe(0);
  });

  it("merges date and time for timed tasks", () => {
    const iso = combineTaskDueDateTime("2026-07-22", "14:30");
    const parsed = new Date(iso);
    expect(parsed.getHours()).toBe(14);
    expect(parsed.getMinutes()).toBe(30);
  });

  it("extracts time from due_date when not midnight", () => {
    const iso = combineTaskDueDateTime("2026-07-22", "09:15");
    expect(extractTaskDueTime(iso)).toBe("09:15:00");
  });

  it("returns null for midnight due dates", () => {
    const iso = combineTaskDueDateTime("2026-07-22", null);
    expect(extractTaskDueTime(iso)).toBeNull();
  });
});
