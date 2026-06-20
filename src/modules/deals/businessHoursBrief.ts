export const BUSINESS_HOURS_DAY_OPTIONS = [
  { value: "Monday", label: "Mon" },
  { value: "Tuesday", label: "Tue" },
  { value: "Wednesday", label: "Wed" },
  { value: "Thursday", label: "Thu" },
  { value: "Friday", label: "Fri" },
  { value: "Saturday", label: "Sat" },
  { value: "Sunday", label: "Sun" },
] as const;

const LEGACY_DAY_KEYS: Record<string, string> = {
  mon: "Monday",
  tue: "Tuesday",
  wed: "Wednesday",
  thu: "Thursday",
  fri: "Friday",
  sat: "Saturday",
  sun: "Sunday",
};

type ScheduleDay = {
  enabled: boolean;
  open: string;
  close: string;
};

export type BusinessHourEntry = {
  day: string;
  open: string;
  close: string;
};

export const parseBusinessHoursBrief = (value: unknown): BusinessHourEntry[] => {
  if (Array.isArray(value)) {
    return value.filter(
      (entry): entry is BusinessHourEntry =>
        entry != null &&
        typeof entry === "object" &&
        "day" in entry &&
        "open" in entry &&
        "close" in entry,
    );
  }

  if (typeof value !== "string" || !value.trim()) return [];

  try {
    const parsed = JSON.parse(value) as unknown;
    if (Array.isArray(parsed)) {
      return parseBusinessHoursBrief(parsed);
    }
    if (parsed && typeof parsed === "object") {
      const record = parsed as Record<string, unknown>;
      if (Array.isArray(record.entries)) {
        return parseBusinessHoursBrief(record.entries);
      }
      const legacy = parsed as Record<string, ScheduleDay>;
      return Object.entries(LEGACY_DAY_KEYS)
        .filter(([key]) => legacy[key]?.enabled)
        .map(([key, day]) => ({
          day,
          open: legacy[key]?.open ?? "08:00",
          close: legacy[key]?.close ?? "17:00",
        }));
    }
  } catch {
    return [];
  }

  return [];
};

const shortDayLabel = (day: string) =>
  BUSINESS_HOURS_DAY_OPTIONS.find((option) => option.value === day)?.label ??
  day.slice(0, 3);

export const formatBusinessHoursBriefLabel = (entries: BusinessHourEntry[]) =>
  entries
    .map((entry) => `${shortDayLabel(entry.day)} ${entry.open}-${entry.close}`)
    .join(", ");

export const serializeBusinessHoursBrief = (entries: BusinessHourEntry[]) =>
  JSON.stringify({
    entries,
    _label: formatBusinessHoursBriefLabel(entries),
  });

/** Human-readable value for brief views (never raw JSON). */
export const formatBusinessHoursBriefDisplay = (
  value: unknown,
  options?: { multiline?: boolean },
): string => {
  const entries = parseBusinessHoursBrief(value);
  if (entries.length === 0) {
    const raw = String(value ?? "").trim();
    if (!raw || raw.startsWith("{")) return "";
    return raw;
  }

  const lines = BUSINESS_HOURS_DAY_OPTIONS.map(({ value: day, label }) => {
    const entry = entries.find((row) => row.day === day);
    if (entry) {
      return `${label} ${entry.open}–${entry.close}`;
    }
    return `${label} Closed`;
  });

  if (options?.multiline) {
    return lines.join("\n");
  }

  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value) as { _label?: unknown };
      if (typeof parsed._label === "string" && parsed._label.trim()) {
        return parsed._label.trim();
      }
    } catch {
      // fall through
    }
  }

  return formatBusinessHoursBriefLabel(entries);
};

export const formatBriefFieldForDisplay = (
  fieldKey: string,
  value: unknown,
): string => {
  if (value == null) return "";
  if (fieldKey === "business_hours") {
    return formatBusinessHoursBriefDisplay(value, { multiline: true });
  }
  if (Array.isArray(value)) {
    return value.map(String).filter(Boolean).join(", ");
  }
  return String(value).trim();
};
