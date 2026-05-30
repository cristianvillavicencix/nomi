export type ParsedFollowUpDateTime = {
  raw: string;
  dateKey: string;
  timeKey: string;
  iso: string;
};

const pad = (value: number) => String(value).padStart(2, "0");

export const toDateTimeLocalValue = (date: Date) =>
  `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;

export const parseFollowUpDateTime = (
  raw: string,
): ParsedFollowUpDateTime | null => {
  const value = raw.trim();
  if (!value) return null;

  if (value.includes("T")) {
    const [dateKey, timePart = ""] = value.split("T");
    const timeKey = timePart.slice(0, 5);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dateKey) || !/^\d{2}:\d{2}$/.test(timeKey)) {
      return null;
    }

    const date = new Date(`${dateKey}T${timeKey}:00`);
    if (Number.isNaN(date.getTime())) return null;

    return {
      raw: value,
      dateKey,
      timeKey,
      iso: date.toISOString(),
    };
  }

  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const date = new Date(`${value}T09:00:00`);
  if (Number.isNaN(date.getTime())) return null;

  return {
    raw: value,
    dateKey: value,
    timeKey: "09:00",
    iso: date.toISOString(),
  };
};

export const formatFollowUpDateTimeLabel = (raw: string) => {
  const parsed = parseFollowUpDateTime(raw);
  const date = parsed ? new Date(parsed.iso) : new Date(raw);
  if (Number.isNaN(date.getTime())) return raw;

  return date.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
};
