import { describe, expect, it } from "vitest";
import {
  normalizeReminderOffsetsMinutes,
  formatReminderOffsetsSummary,
} from "@/modules/calendar/calendarReminderWriteUtils";

describe("calendarReminderWriteUtils", () => {
  it("normalizes and dedupes reminder offsets", () => {
    expect(normalizeReminderOffsetsMinutes([15, 15, 60, 5])).toEqual([
      60, 15, 5,
    ]);
  });

  it("caps reminders at three offsets", () => {
    expect(normalizeReminderOffsetsMinutes([5, 15, 30, 60, 120])).toEqual([
      120, 60, 30,
    ]);
  });

  it("formats reminder summary labels", () => {
    expect(formatReminderOffsetsSummary([1440, 15])).toContain("15 minutes");
  });
});
