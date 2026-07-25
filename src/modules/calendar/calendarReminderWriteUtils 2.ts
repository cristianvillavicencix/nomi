import {
  REMIND_BEFORE_CHOICES,
  REMIND_BEFORE_NONE,
} from "@/modules/calendar/calendarReminderOptions";

const MAX_REMINDERS = 3;

const toOffsetMinutes = (value: unknown): number | null => {
  if (value === REMIND_BEFORE_NONE || value === "" || value == null) return null;
  const minutes = Number(value);
  return Number.isFinite(minutes) && minutes >= 0 ? minutes : null;
};

export const normalizeReminderOffsetsMinutes = (
  value: unknown,
): number[] => {
  if (!Array.isArray(value)) {
    const single = toOffsetMinutes(value);
    return single == null ? [] : [single];
  }

  const seen = new Set<number>();
  const offsets: number[] = [];
  for (const entry of value) {
    const minutes = toOffsetMinutes(entry);
    if (minutes == null || seen.has(minutes)) continue;
    seen.add(minutes);
    offsets.push(minutes);
  }
  return offsets.sort((left, right) => right - left).slice(0, MAX_REMINDERS);
};

export const formatReminderOffsetsForForm = (
  value: unknown,
): (number | typeof REMIND_BEFORE_NONE)[] => {
  const offsets = normalizeReminderOffsetsMinutes(value);
  return offsets.length > 0 ? offsets : [REMIND_BEFORE_NONE];
};

export const formatReminderOffsetsSummary = (offsets: number[]) => {
  if (offsets.length === 0) return null;
  const labels = offsets.map((minutes) => {
    const choice = REMIND_BEFORE_CHOICES.find((entry) => entry.id === minutes);
    return choice?.name ?? `${minutes} min before`;
  });
  return labels.join(", ");
};

export const MAX_CALENDAR_REMINDERS = MAX_REMINDERS;

export const legacyRemindBeforeFromOffsets = (offsets: number[]) =>
  offsets[0] ?? null;
