import { describe, expect, it } from "vitest";
import type { CalendarEvent } from "@/modules/calendar/calendarUtils";
import type { Contact } from "@/components/atomic-crm/types";
import {
  buildWorkItemSearchText,
  matchesWorkItemSearch,
} from "@/modules/work/workItemSearch";
import type { WorkItem } from "@/modules/work/workTypes";

const makeItem = (
  overrides: Partial<WorkItem> & Pick<WorkItem, "event">,
): WorkItem => ({
  id: "item-1",
  category: "follow_up",
  title: "Reminder",
  date: "2026-07-21",
  done: false,
  overdue: false,
  ...overrides,
});

describe("workItemSearch", () => {
  it("matches contact name and category aliases for follow ups", () => {
    const item = makeItem({
      category: "follow_up",
      title: "Reminder",
      event: {
        kind: "reminder",
        id: "reminder:1",
        date: "2026-07-21",
        title: "Reminder",
        record: {
          id: 1,
          title: "Reminder",
          event_date: "2026-07-21",
          description: "Call about proposal",
          contact_id: 42,
        },
        done: false,
        contactName: "Maria Lopez",
      } as CalendarEvent,
    });

    expect(matchesWorkItemSearch(item, "maria")).toBe(true);
    expect(matchesWorkItemSearch(item, "follow up")).toBe(true);
    expect(matchesWorkItemSearch(item, "proposal")).toBe(true);
    expect(matchesWorkItemSearch(item, "meeting")).toBe(false);
  });

  it("matches all query tokens across different fields", () => {
    const item = makeItem({
      category: "task",
      title: "Send contract",
      dealName: "Acme Website",
      event: {
        kind: "task",
        id: "task:1",
        date: "2026-07-21",
        title: "Send contract",
        task: { id: 1, text: "Send contract", type: "call", due_date: "2026-07-21" },
        overdue: false,
        done: false,
      } as CalendarEvent,
    });

    expect(matchesWorkItemSearch(item, "acme contract")).toBe(true);
    expect(matchesWorkItemSearch(item, "contract acme")).toBe(true);
    expect(matchesWorkItemSearch(item, "acme delivery")).toBe(false);
  });

  it("resolves task contact names from the contacts map", () => {
    const item = makeItem({
      category: "task",
      title: "Follow up",
      event: {
        kind: "task",
        id: "task:2",
        date: "2026-07-22",
        title: "Follow up",
        task: {
          id: 2,
          text: "Follow up",
          type: "none",
          due_date: "2026-07-22",
          contact_id: 7,
        },
        overdue: false,
        done: false,
      } as CalendarEvent,
    });

    const contactsById = new Map<string, Contact>([
      [
        "7",
        {
          id: 7,
          first_name: "John",
          last_name: "Smith",
        } as Contact,
      ],
    ]);

    expect(
      buildWorkItemSearchText(item, contactsById).includes("john smith"),
    ).toBe(true);
    expect(matchesWorkItemSearch(item, "john", contactsById)).toBe(true);
  });
});
