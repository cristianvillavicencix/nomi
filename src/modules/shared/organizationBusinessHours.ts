import type { BusinessHoursConfig } from "@/modules/types";

export const COMMUNICATIONS_WEEKDAY_KEYS = [
  "sunday",
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
] as const;

export type CommunicationsWeekdayKey =
  (typeof COMMUNICATIONS_WEEKDAY_KEYS)[number];

const WEEKDAY_LABELS: Record<CommunicationsWeekdayKey, string> = {
  sunday: "Sun",
  monday: "Mon",
  tuesday: "Tue",
  wednesday: "Wed",
  thursday: "Thu",
  friday: "Fri",
  saturday: "Sat",
};

export const getCommunicationsDayKey = (date: Date): CommunicationsWeekdayKey =>
  COMMUNICATIONS_WEEKDAY_KEYS[date.getDay()];

export const hasConfiguredBusinessHours = (
  config: BusinessHoursConfig | null | undefined,
) => config != null && Object.keys(config).length > 0;

export const isCommunicationsDayOpen = (
  config: BusinessHoursConfig | null | undefined,
  dayKey: CommunicationsWeekdayKey,
) => {
  const entry = config?.[dayKey];
  return Boolean(entry && entry.closed !== true);
};

export const formatBusinessHoursSummary = (
  config: BusinessHoursConfig | null | undefined,
): string | null => {
  if (!hasConfiguredBusinessHours(config)) return null;

  const lines = COMMUNICATIONS_WEEKDAY_KEYS.map((dayKey) => {
    const entry = config?.[dayKey];
    const label = WEEKDAY_LABELS[dayKey];
    if (!entry || entry.closed) return `${label} closed`;
    const open = entry.open?.trim().slice(0, 5) || "09:00";
    const close = entry.close?.trim().slice(0, 5) || "18:00";
    return `${label} ${open}–${close}`;
  });

  return lines.join(" · ");
};

export const BUSINESS_HOURS_SETTINGS_PATH = "/settings?tab=connectors&section=twilio";
