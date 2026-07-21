import type { BusinessHoursConfig } from "@/modules/types";
import {
  getCommunicationsDayKey,
  hasConfiguredBusinessHours,
  isCommunicationsDayOpen,
} from "@/modules/shared/organizationBusinessHours";
import type { TicketWorkspaceSettings } from "@/modules/settings/tickets/ticketWorkspaceSettings";
import {
  parseDateKey,
  type CalendarDisplayOptions,
} from "@/modules/calendar/calendarUtils";
import { parseTimeToMinutes } from "@/modules/calendar/calendarTimeGridUtils";

export const BUSINESS_DAY_KEYS = [
  "sun",
  "mon",
  "tue",
  "wed",
  "thu",
  "fri",
  "sat",
] as const;

export type BusinessDayKey = (typeof BUSINESS_DAY_KEYS)[number];

export type CalendarDaySchedule = {
  closed: boolean;
  startHour: number;
  endHour: number;
  startMinutes: number;
  endMinutes: number;
};

export type CalendarBusinessHoursSchedule = {
  enabled: boolean;
  source: "communications" | "tickets" | "none";
  displayOptions: CalendarDisplayOptions;
  gridStartHour: number;
  gridEndHour: number;
  getDaySchedule: (date: Date | string) => CalendarDaySchedule;
  isWithinBusinessHours: (dateKey: string, time?: string | null) => boolean;
};

const DEFAULT_WEEKDAY = {
  enabled: true,
  start: "08:00",
  end: "16:30",
};

const DEFAULT_SATURDAY = {
  enabled: true,
  start: "09:00",
  end: "14:00",
};

const DEFAULT_SUNDAY = {
  enabled: false,
  start: "09:00",
  end: "12:00",
};

const CLOSED_DAY_SCHEDULE = (): CalendarDaySchedule => ({
  closed: true,
  startHour: 8,
  endHour: 17,
  startMinutes: 8 * 60,
  endMinutes: 17 * 60,
});

const parseHourPart = (time: string) => {
  const minutes = parseTimeToMinutes(time.length === 5 ? `${time}:00` : time);
  if (minutes == null) return null;
  return {
    minutes,
    hour: Math.floor(minutes / 60),
    endHour: Math.ceil(minutes / 60) || Math.floor(minutes / 60) + 1,
  };
};

const buildOpenDaySchedule = (startTime: string, endTime: string) => {
  const start = parseHourPart(startTime);
  const end = parseHourPart(endTime);
  const startMinutes = start?.minutes ?? 8 * 60;
  const endMinutes = end?.minutes ?? 17 * 60;
  const endHour = Math.max(
    Math.ceil(endMinutes / 60),
    (start?.hour ?? 8) + 1,
  );

  return {
    closed: false,
    startHour: start?.hour ?? 8,
    endHour,
    startMinutes,
    endMinutes,
  };
};

const getBusinessDayKey = (date: Date): BusinessDayKey =>
  BUSINESS_DAY_KEYS[date.getDay()];

export const resolveDayScheduleFromCommunications = (
  config: BusinessHoursConfig | null | undefined,
  date: Date,
): CalendarDaySchedule => {
  const dayKey = getCommunicationsDayKey(date);
  const entry = config?.[dayKey];

  if (!entry || entry.closed) {
    return CLOSED_DAY_SCHEDULE();
  }

  return buildOpenDaySchedule(
    entry.open?.trim() || "09:00",
    entry.close?.trim() || "18:00",
  );
};

/** @deprecated Legacy ticket workspace schedule — use Communications settings instead. */
export const resolveDayScheduleFromWorkspace = (
  workspace: TicketWorkspaceSettings | undefined,
  date: Date,
): CalendarDaySchedule => {
  const key = getBusinessDayKey(date);
  const defaults =
    key === "sat"
      ? DEFAULT_SATURDAY
      : key === "sun"
        ? DEFAULT_SUNDAY
        : DEFAULT_WEEKDAY;

  const row = workspace?.business_hours?.[key] ?? defaults;
  const enabled = workspace?.business_hours_enabled
    ? row.enabled
    : key !== "sun";

  if (!enabled) {
    return CLOSED_DAY_SCHEDULE();
  }

  return buildOpenDaySchedule(
    row.start || defaults.start,
    row.end || defaults.end,
  );
};

export type BuildCalendarBusinessHoursOptions = {
  communications?: BusinessHoursConfig | null;
  workspace?: TicketWorkspaceSettings | null;
  fallbackDisplay: CalendarDisplayOptions;
};

export const buildCalendarBusinessHoursSchedule = ({
  communications,
  workspace,
  fallbackDisplay,
}: BuildCalendarBusinessHoursOptions): CalendarBusinessHoursSchedule => {
  const usesCommunications = hasConfiguredBusinessHours(communications);
  const usesTickets =
    !usesCommunications && Boolean(workspace?.business_hours_enabled);
  const enabled = usesCommunications || usesTickets;
  const source: CalendarBusinessHoursSchedule["source"] = usesCommunications
    ? "communications"
    : usesTickets
      ? "tickets"
      : "none";

  const displayOptions: CalendarDisplayOptions = usesCommunications
    ? {
        showSaturday: isCommunicationsDayOpen(communications, "saturday"),
        showSunday: isCommunicationsDayOpen(communications, "sunday"),
      }
    : usesTickets
      ? {
          showSaturday: Boolean(
            workspace?.business_hours?.sat?.enabled ??
              DEFAULT_SATURDAY.enabled,
          ),
          showSunday: Boolean(
            workspace?.business_hours?.sun?.enabled ?? DEFAULT_SUNDAY.enabled,
          ),
        }
      : fallbackDisplay;

  const resolveDay = (date: Date) => {
    if (usesCommunications) {
      return resolveDayScheduleFromCommunications(communications, date);
    }
    if (usesTickets) {
      return resolveDayScheduleFromWorkspace(workspace ?? undefined, date);
    }
    return CLOSED_DAY_SCHEDULE();
  };

  const sampleWeek = BUSINESS_DAY_KEYS.map((_, index) => {
    const date = new Date(2026, 0, 4 + index);
    return resolveDay(date);
  });

  const openDays = sampleWeek.filter((day) => !day.closed);
  const gridStartHour =
    openDays.length > 0
      ? Math.min(...openDays.map((day) => day.startHour))
      : 8;
  const gridEndHour =
    openDays.length > 0
      ? Math.max(...openDays.map((day) => day.endHour))
      : 17;

  const getDaySchedule = (date: Date | string) => {
    const parsed = typeof date === "string" ? parseDateKey(date) : date;
    return resolveDay(parsed);
  };

  const isWithinBusinessHours = (dateKey: string, time?: string | null) => {
    if (!enabled) return true;
    const schedule = getDaySchedule(dateKey);
    if (schedule.closed) return false;
    if (!time?.trim()) return true;
    const minutes = parseTimeToMinutes(time);
    if (minutes == null) return true;
    return minutes >= schedule.startMinutes && minutes < schedule.endMinutes;
  };

  return {
    enabled,
    source,
    displayOptions,
    gridStartHour,
    gridEndHour,
    getDaySchedule,
    isWithinBusinessHours,
  };
};

export const isEventOutsideBusinessHours = (
  event: { date: string; time?: string | null },
  schedule: CalendarBusinessHoursSchedule,
) =>
  schedule.enabled &&
  !schedule.isWithinBusinessHours(event.date, event.time ?? null);
