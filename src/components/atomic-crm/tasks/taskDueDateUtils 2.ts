export const normalizeTaskDueDateKey = (value: unknown) => {
  if (value == null || value === "") return "";
  const parsed = new Date(String(value));
  if (Number.isNaN(parsed.getTime())) {
    return String(value).slice(0, 10);
  }
  parsed.setHours(0, 0, 0, 0);
  return parsed.toISOString().slice(0, 10);
};

export const hasTaskDueDateChanged = (
  previous: Record<string, unknown> | undefined,
  current: Record<string, unknown>,
) =>
  Boolean(previous) &&
  normalizeTaskDueDateKey(previous?.due_date) !==
    normalizeTaskDueDateKey(current.due_date);

export const formatTaskDueDateLabel = (value: unknown) => {
  const key = normalizeTaskDueDateKey(value);
  if (!key) return "No due date";
  const parsed = new Date(`${key}T12:00:00`);
  if (Number.isNaN(parsed.getTime())) return key;
  return parsed.toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  });
};
