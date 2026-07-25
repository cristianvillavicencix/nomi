import { describe, expect, it } from "vitest";

import { DEFAULT_NOTIFICATION_PREFS } from "./notificationPrefs";
import {
  canAccessNotificationCategory,
  filterNotificationCategoryGroups,
  sanitizeNotificationPrefsForCapabilities,
} from "./notificationCategoryAccess";

const standardUserCapabilities = (id: string) =>
  ({
    "messaging.conversations.view": true,
    "crm.tasks.view": true,
    "meetings.manage": true,
    "support.tickets.view": false,
    "crm.contacts.view": false,
  })[id] ?? false;

describe("notificationCategoryAccess", () => {
  it("hides tickets and leads groups for standard users", () => {
    const groups = filterNotificationCategoryGroups(standardUserCapabilities);
    const titles = groups.map((g) => g.title);
    expect(titles).toContain("Messages");
    expect(titles).toContain("Tasks");
    expect(titles).toContain("Bookings");
    expect(titles).not.toContain("Tickets");
    expect(titles).not.toContain("Leads");
  });

  it("blocks ticket categories without support.tickets.view", () => {
    expect(
      canAccessNotificationCategory(
        "tickets_assigned",
        standardUserCapabilities,
      ),
    ).toBe(false);
  });

  it("forces disallowed categories off when saving prefs", () => {
    const sanitized = sanitizeNotificationPrefsForCapabilities(
      {
        ...DEFAULT_NOTIFICATION_PREFS,
        tickets_assigned: true,
        leads_stale: true,
      },
      standardUserCapabilities,
    );
    expect(sanitized.tickets_assigned).toBe(false);
    expect(sanitized.leads_stale).toBe(false);
    expect(sanitized.tasks_mention).toBe(true);
  });
});
