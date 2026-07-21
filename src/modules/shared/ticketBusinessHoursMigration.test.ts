import { describe, expect, it } from "vitest";
import type { TicketWorkspaceSettings } from "@/modules/settings/tickets/ticketWorkspaceSettings";
import {
  migrateTicketBusinessHoursToCommunications,
  resolveBusinessHoursForSave,
  resolveInitialBusinessHours,
} from "@/modules/shared/ticketBusinessHoursMigration";

const legacyWorkspace = {
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

describe("ticketBusinessHoursMigration", () => {
  it("maps ticket day keys to communications format", () => {
    const migrated = migrateTicketBusinessHoursToCommunications(legacyWorkspace);

    expect(migrated.monday).toEqual({
      open: "08:00",
      close: "16:30",
      closed: false,
    });
    expect(migrated.saturday).toEqual({
      open: "09:00",
      close: "14:00",
      closed: false,
    });
    expect(migrated.sunday).toEqual({
      open: "09:00",
      close: "12:00",
      closed: true,
    });
  });

  it("prefills communications from legacy tickets when empty", () => {
    const initial = resolveInitialBusinessHours({}, legacyWorkspace);
    expect(initial.importedFromTickets).toBe(true);
    expect(initial.hours.monday?.open).toBe("08:00");
  });

  it("migrates legacy schedule on save when communications hours are empty", () => {
    const resolved = resolveBusinessHoursForSave({}, null, legacyWorkspace);
    expect(resolved.migratedFromTickets).toBe(true);
    expect(resolved.businessHours.friday?.close).toBe("16:30");
  });
});
