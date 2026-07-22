import { normalizeEventTime } from "@/modules/calendar/calendarReminderOptions";

const toDateKey = (value: unknown) => {
  const raw = String(value ?? "").trim();
  if (!raw) return null;
  return raw.length >= 10 ? raw.slice(0, 10) : null;
};

/** Merge calendar date + optional time into a task due_date ISO string. */
export const combineTaskDueDateTime = (
  dueDate: unknown,
  dueTime?: unknown,
): string => {
  const dateKey = toDateKey(dueDate);
  if (!dateKey) {
    const fallback = new Date(String(dueDate));
    fallback.setHours(0, 0, 0, 0);
    return fallback.toISOString();
  }

  const normalizedTime = normalizeEventTime(
    dueTime == null || dueTime === "" ? null : String(dueTime),
  );

  if (!normalizedTime) {
    const midnight = new Date(`${dateKey}T00:00:00`);
    midnight.setHours(0, 0, 0, 0);
    return midnight.toISOString();
  }

  const [hoursRaw, minutesRaw] = normalizedTime.split(":");
  const hours = Number(hoursRaw);
  const minutes = Number(minutesRaw ?? 0);
  const combined = new Date(`${dateKey}T00:00:00`);
  combined.setHours(
    Number.isFinite(hours) ? hours : 0,
    Number.isFinite(minutes) ? minutes : 0,
    0,
    0,
  );
  return combined.toISOString();
};

/** Read HH:MM:SS from a task due_date when it is not midnight-local. */
export const extractTaskDueTime = (dueDate?: string | null): string | null => {
  if (!dueDate?.trim()) return null;
  const parsed = new Date(dueDate);
  if (Number.isNaN(parsed.getTime())) return null;

  const hours = parsed.getHours();
  const minutes = parsed.getMinutes();
  const seconds = parsed.getSeconds();
  if (hours === 0 && minutes === 0 && seconds === 0) return null;

  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
};
