import { describe, expect, it } from "vitest";
import {
  hasCalendarScheduleChanged,
  isVideoMeetingRecord,
} from "@/modules/calendar/calendarEventScheduleUtils";

describe("calendarEventScheduleUtils", () => {
  it("detects date/time/duration/title changes", () => {
    const base = {
      event_date: "2026-07-21",
      event_time: "10:00",
      duration_minutes: 30,
      title: "Review scope",
    };

    expect(hasCalendarScheduleChanged(base, base)).toBe(false);
    expect(
      hasCalendarScheduleChanged(base, { ...base, event_date: "2026-07-22" }),
    ).toBe(true);
    expect(
      hasCalendarScheduleChanged(base, { ...base, event_time: "11:00" }),
    ).toBe(true);
    expect(
      hasCalendarScheduleChanged(base, { ...base, duration_minutes: 60 }),
    ).toBe(true);
    expect(
      hasCalendarScheduleChanged(base, { ...base, title: "Updated title" }),
    ).toBe(true);
  });

  it("identifies video meetings by format or legacy meeting_url", () => {
    expect(
      isVideoMeetingRecord({
        meeting_format: "video",
        meeting_url: "https://meet.jit.si/demo",
      }),
    ).toBe(true);
    expect(isVideoMeetingRecord({ meeting_url: "https://meet.jit.si/demo" })).toBe(
      true,
    );
    expect(isVideoMeetingRecord({ meeting_format: "phone" })).toBe(false);
    expect(isVideoMeetingRecord({ meeting_url: null })).toBe(false);
  });
});
