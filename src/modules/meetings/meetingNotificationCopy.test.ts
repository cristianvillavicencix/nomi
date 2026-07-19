import { describe, expect, it } from "vitest";
import { prepareCalendarEventWriteData } from "@/modules/calendar/calendarEventWriteData";
import {
  buildClientMeetingConfirmationSmsPreview,
  formatMeetingScheduleLine,
  resolveClientTimezone,
} from "@/modules/meetings/meetingNotificationCopy";
import { buildQuickMeetingShareParts } from "@/modules/meetings/quickMeetingShareMessage";

describe("meeting dual timezone copy", () => {
  it("shows host ET and client CT when timezones differ", () => {
    const line = formatMeetingScheduleLine({
      eventDate: "2026-07-20",
      eventTime: "11:00",
      durationMinutes: 60,
      meetingTimezone: "America/New_York",
      viewerTimezone: "America/Chicago",
    });

    expect(line).toContain("11:00 AM");
    expect(line).toContain("12:00 PM");
    expect(line).toContain("ET");
    expect(line).toMatch(/10:00 AM CT your time/);
  });

  it("omits client local hint when same timezone", () => {
    const line = formatMeetingScheduleLine({
      eventDate: "2026-07-20",
      eventTime: "11:00",
      durationMinutes: 60,
      meetingTimezone: "America/New_York",
      viewerTimezone: "America/New_York",
    });

    expect(line).toContain("ET");
    expect(line).not.toMatch(/your time/);
  });

  it("resolves client timezone from contact.timezone first", () => {
    expect(
      resolveClientTimezone({
        timezone: "America/Chicago",
        state_abbr: "NY",
      }),
    ).toBe("America/Chicago");
  });

  it("infers client timezone from Texas address when missing", () => {
    expect(
      resolveClientTimezone({
        timezone: null,
        state_abbr: "TX",
        zipcode: "78640",
        country: "United States",
      }),
    ).toBe("America/Chicago");
  });

  it("SMS preview includes dual time for NY host + TX client", () => {
    const sms = buildClientMeetingConfirmationSmsPreview({
      contactFirstName: "Guillermo",
      hostFirstName: "Cristian",
      orgName: "Latino Business Support",
      meetingUrl: "https://meet.jit.si/example",
      eventDate: "2026-07-20",
      eventTime: "11:00",
      durationMinutes: 60,
      meetingTimezone: "America/New_York",
      clientTimezone: "America/Chicago",
    });

    expect(sms).toContain("You're booked for a video call:");
    expect(sms).toMatch(/10:00 AM CT your time/);
    expect(sms).toContain("Join: https://meet.jit.si/example");
  });

  it("quick share parts SMS matches dual-time confirmation", () => {
    const share = buildQuickMeetingShareParts({
      contact: {
        id: 1,
        first_name: "Guillermo",
        last_name: "Salvador",
        timezone: "America/Chicago",
      } as never,
      meetingUrl: "https://meet.jit.si/example",
      senderFirstName: "Cristian",
      orgName: "Latino Business Support",
      eventDate: "2026-07-20",
      eventTime: "11:00",
      durationMinutes: 60,
      meetingTimezone: "America/New_York",
    });

    expect(share.smsBody).toMatch(/10:00 AM CT your time/);
    expect(share.intro).toMatch(/10:00 AM CT your time/);
  });
});

describe("prepareCalendarEventWriteData timezone stamp", () => {
  it("stamps default workspace timezone when missing", () => {
    const row = prepareCalendarEventWriteData(
      {
        title: "Call",
        event_date: "2026-07-20",
        event_time: "11:00",
      },
      { defaultTimezone: "America/New_York" },
    );
    expect(row.timezone).toBe("America/New_York");
  });

  it("does not overwrite an existing timezone", () => {
    const row = prepareCalendarEventWriteData(
      {
        title: "Call",
        event_date: "2026-07-20",
        timezone: "America/Chicago",
      },
      { defaultTimezone: "America/New_York" },
    );
    expect(row.timezone).toBe("America/Chicago");
  });
});
