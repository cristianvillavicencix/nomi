import { describe, expect, it } from "vitest";
import type { CalendarEventRecord } from "@/components/atomic-crm/types";
import { combineTaskDueDateTime } from "@/components/atomic-crm/tasks/taskDueDateTime";
import {
  buildCalendarEntryEvent,
  buildDealCalendarEvents,
  buildTaskCalendarEvent,
  getEventChipLabel,
  getEventChipTooltip,
  getEventLabel,
} from "@/modules/calendar/calendarUtils";

const baseRecord = (
  overrides: Partial<CalendarEventRecord> = {},
): CalendarEventRecord => ({
  id: 1,
  title: "Reminder",
  event_date: "2026-06-22",
  event_time: "10:00:00",
  duration_minutes: 30,
  remind_before_minutes: 15,
  reminder_offsets_minutes: null,
  reminder_sent_at: null,
  description: null,
  meeting_url: null,
  timezone: null,
  deal_id: null,
  contact_id: 10,
  company_id: null,
  organization_member_id: null,
  assignee_member_ids: null,
  completed_at: null,
  created_at: "2026-06-01T00:00:00Z",
  updated_at: "2026-06-01T00:00:00Z",
  ...overrides,
});

describe("getEventChipLabel", () => {
  it("leads with preview text and puts short time last", () => {
    const event = buildCalendarEntryEvent(baseRecord({
      title: "Follow up with lead",
      contact_id: 10,
    }), { contactName: "Stanley Ordoñez" });

    expect(event).not.toBeNull();
    expect(getEventChipLabel(event!)).toBe(
      "Follow up with lead · Stanley Ordoñez · 10:00 AM",
    );
  });

  it("uses description preview when title is generic", () => {
    const event = buildCalendarEntryEvent(baseRecord({
      title: "Reminder",
      description: "Call client back\nSecond line ignored",
    }), { contactName: "Jane Doe" });

    expect(getEventChipLabel(event!)).toBe(
      "Call client back · Jane Doe · 10:00 AM",
    );
  });

  it("uses activity notes when title is Activity", () => {
    const event = buildCalendarEntryEvent(baseRecord({
      title: "Activity",
      description:
        "New -> Contacted\nCómo contactaste: SMS / WhatsApp\nQué pasó: Numero no sirve.",
    }), { contactName: "Stanley Ordoñez" });

    expect(getEventChipLabel(event!)).toBe(
      "New -> Contacted · Stanley Ordoñez · 10:00 AM",
    );
  });

  it("shows only project name for delivery and start events", () => {
    const events = buildDealCalendarEvents({
      id: 5,
      name: "Kitchen remodel",
      expected_end_date: "2026-06-30",
      start_date: "2026-06-01",
    } as never);
    const delivery = events.find((event) => event.kind === "project_delivery");

    expect(delivery).toBeDefined();
    expect(getEventChipLabel(delivery!)).toBe("Kitchen remodel");
  });

  it("keeps untimed task text without a time suffix", () => {
    const event = buildTaskCalendarEvent({
      id: 1,
      due_date: combineTaskDueDateTime("2026-06-22", null),
      text: "Review proposal",
      done_date: null,
    } as never);

    expect(event).not.toBeNull();
    expect(getEventChipLabel(event!)).toBe("Review proposal");
  });

  it("appends time to timed tasks", () => {
    const event = buildTaskCalendarEvent({
      id: 2,
      due_date: combineTaskDueDateTime("2026-06-22", "10:30"),
      text: "Review proposal",
      done_date: null,
    } as never);

    expect(getEventChipLabel(event!)).toContain("Review proposal");
    expect(getEventChipLabel(event!)).toContain("10:30 AM");
  });
});

describe("getEventChipTooltip", () => {
  it("includes full time range and longer description on hover", () => {
    const event = buildCalendarEntryEvent(baseRecord({
      title: "Follow up with lead",
      description: "New -> Contacted\nCómo contactaste: SMS / WhatsApp",
    }), { contactName: "Stanley Ordoñez" });

    expect(getEventChipTooltip(event!)).toContain("Follow up with lead");
    expect(getEventChipTooltip(event!)).toContain("10:00 AM – 10:30 AM");
    expect(getEventChipTooltip(event!)).toContain("New -> Contacted");
  });
});

describe("getEventLabel", () => {
  it("keeps verbose type prefix for detail surfaces", () => {
    const event = buildCalendarEntryEvent(baseRecord({
      title: "Follow up with lead",
    }), { contactName: "Stanley Ordoñez" });

    expect(getEventLabel(event!)).toContain("Activity ·");
  });
});
