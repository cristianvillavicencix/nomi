import { describe, expect, it } from "vitest";
import {
  buildCalendarBusinessHoursSchedule,
  isEventOutsideBusinessHours,
  resolveDayScheduleFromCommunications,
} from "@/modules/calendar/calendarBusinessHours";
import type { BusinessHoursConfig } from "@/modules/types";
import type { TicketWorkspaceSettings } from "@/modules/settings/tickets/ticketWorkspaceSettings";

const communicationsHours: BusinessHoursConfig = {
  monday: { open: "08:00", close: "16:30", closed: false },
  tuesday: { open: "08:00", close: "16:30", closed: false },
  wednesday: { open: "08:00", close: "16:30", closed: false },
  thursday: { open: "08:00", close: "16:30", closed: false },
  friday: { open: "08:00", close: "16:30", closed: false },
  saturday: { open: "09:00", close: "14:00", closed: false },
  sunday: { closed: true },
};

const legacyTicketWorkspace: TicketWorkspaceSettings = {
  business_hours_enabled: true,
  business_hours_timezone: "America/New_York",
  business_hours: {
    mon: { enabled: true, start: "08:00", end: "16:30" },
    tue: { enabled: true, start: "08:00", end: "16:30" },
    wed: { enabled: true, start: "08:00", end: "16:30" },
    thu: { enabled: true, start: "08:00", end: "16:30" },
    fri: { enabled: true, start: "08:00", end: "16:30" },
    sat: { enabled: true, start: "09:00", end: "14:00" },
    sun: { enabled: false, start: "09:00", end: "12:00" },
  },
} as TicketWorkspaceSettings;

describe("calendarBusinessHours", () => {
  it("prefers Communications settings when configured", () => {
    const schedule = buildCalendarBusinessHoursSchedule({
      communications: communicationsHours,
      workspace: legacyTicketWorkspace,
      fallbackDisplay: { showSaturday: false, showSunday: true },
    });

    expect(schedule.enabled).toBe(true);
    expect(schedule.source).toBe("communications");
    expect(schedule.displayOptions.showSaturday).toBe(true);
    expect(schedule.displayOptions.showSunday).toBe(false);
    expect(schedule.getDaySchedule("2026-07-19").closed).toBe(true);
  });

  it("respects weekday and Saturday windows from Communications", () => {
    const schedule = buildCalendarBusinessHoursSchedule({
      communications: communicationsHours,
      fallbackDisplay: { showSaturday: false, showSunday: false },
    });

    expect(schedule.isWithinBusinessHours("2026-07-20", "08:00")).toBe(true);
    expect(schedule.isWithinBusinessHours("2026-07-20", "16:30")).toBe(false);
    expect(schedule.isWithinBusinessHours("2026-07-18", "08:30")).toBe(false);
    expect(schedule.isWithinBusinessHours("2026-07-18", "10:00")).toBe(true);
  });

  it("falls back to legacy ticket workspace when Communications is empty", () => {
    const schedule = buildCalendarBusinessHoursSchedule({
      communications: {},
      workspace: legacyTicketWorkspace,
      fallbackDisplay: { showSaturday: false, showSunday: true },
    });

    expect(schedule.source).toBe("tickets");
    expect(schedule.enabled).toBe(true);
    expect(schedule.getDaySchedule("2026-07-19").closed).toBe(true);
  });

  it("falls back to user display prefs when business hours are disabled", () => {
    const schedule = buildCalendarBusinessHoursSchedule({
      communications: null,
      workspace: null,
      fallbackDisplay: { showSaturday: false, showSunday: true },
    });

    expect(schedule.enabled).toBe(false);
    expect(schedule.source).toBe("none");
    expect(schedule.displayOptions).toEqual({
      showSaturday: false,
      showSunday: true,
    });
  });

  it("flags events outside configured hours", () => {
    const schedule = buildCalendarBusinessHoursSchedule({
      communications: communicationsHours,
      fallbackDisplay: { showSaturday: true, showSunday: false },
    });

    expect(
      isEventOutsideBusinessHours(
        { date: "2026-07-20", time: "07:30" },
        schedule,
      ),
    ).toBe(true);
    expect(
      isEventOutsideBusinessHours(
        { date: "2026-07-20", time: "09:00" },
        schedule,
      ),
    ).toBe(false);
  });

  it("uses default weekday schedule when a Communications day is missing", () => {
    const monday = new Date(2026, 6, 20);
    const day = resolveDayScheduleFromCommunications(
      { monday: { open: "08:00", close: "16:30" } },
      monday,
    );

    expect(day.closed).toBe(false);
    expect(day.startHour).toBe(8);
    expect(day.endMinutes).toBe(16 * 60 + 30);
  });
});
