import type { BusinessHoursConfig } from "@/modules/types";
import type { TicketWorkspaceSettings } from "@/modules/settings/tickets/ticketWorkspaceSettings";
import {
  COMMUNICATIONS_WEEKDAY_KEYS,
  hasConfiguredBusinessHours,
  type CommunicationsWeekdayKey,
} from "@/modules/shared/organizationBusinessHours";

const TICKET_DAY_KEYS = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"] as const;

const TICKET_TO_COMMUNICATIONS_DAY: Record<
  (typeof TICKET_DAY_KEYS)[number],
  CommunicationsWeekdayKey
> = {
  mon: "monday",
  tue: "tuesday",
  wed: "wednesday",
  thu: "thursday",
  fri: "friday",
  sat: "saturday",
  sun: "sunday",
};

const normalizeTime = (value?: string | null, fallback = "09:00") =>
  String(value ?? fallback).trim().slice(0, 5) || fallback;

export const migrateTicketBusinessHoursToCommunications = (
  workspace: TicketWorkspaceSettings,
): BusinessHoursConfig => {
  const result: BusinessHoursConfig = {};

  for (const shortKey of TICKET_DAY_KEYS) {
    const row = workspace.business_hours?.[shortKey];
    if (!row) continue;
    const dayKey = TICKET_TO_COMMUNICATIONS_DAY[shortKey];
    result[dayKey] = {
      open: normalizeTime(row.start, "09:00"),
      close: normalizeTime(row.end, "17:00"),
      closed: !row.enabled,
    };
  }

  return result;
};

export const resolveInitialBusinessHours = (
  communicationsHours: BusinessHoursConfig | null | undefined,
  ticketWorkspace: TicketWorkspaceSettings | undefined,
): { hours: BusinessHoursConfig; importedFromTickets: boolean } => {
  if (hasConfiguredBusinessHours(communicationsHours)) {
    return { hours: communicationsHours ?? {}, importedFromTickets: false };
  }

  if (ticketWorkspace?.business_hours_enabled) {
    const migrated = migrateTicketBusinessHoursToCommunications(ticketWorkspace);
    if (hasConfiguredBusinessHours(migrated)) {
      return { hours: migrated, importedFromTickets: true };
    }
  }

  return { hours: communicationsHours ?? {}, importedFromTickets: false };
};

export const resolveBusinessHoursForSave = (
  payloadHours: BusinessHoursConfig | undefined,
  currentHours: BusinessHoursConfig | null | undefined,
  ticketWorkspace: TicketWorkspaceSettings | undefined,
): { businessHours: BusinessHoursConfig; migratedFromTickets: boolean } => {
  if (hasConfiguredBusinessHours(payloadHours)) {
    return { businessHours: payloadHours!, migratedFromTickets: false };
  }

  if (ticketWorkspace?.business_hours_enabled) {
    const migrated = migrateTicketBusinessHoursToCommunications(ticketWorkspace);
    if (hasConfiguredBusinessHours(migrated)) {
      return { businessHours: migrated, migratedFromTickets: true };
    }
  }

  if (hasConfiguredBusinessHours(currentHours)) {
    return { businessHours: currentHours ?? {}, migratedFromTickets: false };
  }

  return { businessHours: payloadHours ?? {}, migratedFromTickets: false };
};

export const buildDefaultCommunicationsBusinessHours = (): BusinessHoursConfig =>
  Object.fromEntries(
    COMMUNICATIONS_WEEKDAY_KEYS.map((dayKey) => [
      dayKey,
      {
        open: "09:00",
        close: "18:00",
        closed: dayKey === "sunday",
      },
    ]),
  );
