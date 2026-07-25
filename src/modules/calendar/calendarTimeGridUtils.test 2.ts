import { describe, expect, it } from "vitest";
import type { CalendarEvent } from "@/modules/calendar/calendarUtils";
import {
  formatMinutesAsTime,
  getEventDurationMinutes,
  getEventStartMinutes,
  layoutTimedEvents,
  parseTimeToMinutes,
  splitTimedAndUntimedEvents,
} from "@/modules/calendar/calendarTimeGridUtils";

const meetingEvent = {
  kind: "meeting",
  id: "meeting:1",
  date: "2026-07-21",
  time: "10:30:00",
  title: "Client call",
  record: {
    id: 1,
    event_date: "2026-07-21",
    event_time: "10:30:00",
    duration_minutes: 60,
    title: "Client call",
  },
  done: false,
} as CalendarEvent;

describe("calendarTimeGridUtils", () => {
  it("parses time strings to minutes", () => {
    expect(parseTimeToMinutes("09:15:00")).toBe(555);
    expect(parseTimeToMinutes(null)).toBeNull();
  });

  it("formats minutes as time", () => {
    expect(formatMinutesAsTime(555)).toBe("09:15:00");
  });

  it("splits timed and untimed events", () => {
    const taskEvent = {
      kind: "task",
      id: "task:1",
      date: "2026-07-21",
      title: "Follow up",
      task: {} as never,
      overdue: false,
      done: false,
    } satisfies CalendarEvent;

    const { timed, untimed } = splitTimedAndUntimedEvents([
      meetingEvent,
      taskEvent,
    ]);

    expect(timed).toHaveLength(1);
    expect(untimed).toHaveLength(1);
  });

  it("lays out timed blocks with duration", () => {
    const blocks = layoutTimedEvents([meetingEvent]);
    expect(blocks).toHaveLength(1);
    expect(getEventStartMinutes(meetingEvent)).toBe(630);
    expect(getEventDurationMinutes(meetingEvent)).toBe(60);
    expect(blocks[0]?.heightPx).toBeGreaterThan(0);
  });
});
