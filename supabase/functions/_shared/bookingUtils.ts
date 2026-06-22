export type BookingSettings = {
  enabled?: boolean;
  timezone_label?: string;
  slot_times?: string[];
  duration_minutes?: number;
  booking_horizon_days?: number;
  page_title?: string;
};

export const DEFAULT_BOOKING_SETTINGS: Required<BookingSettings> = {
  enabled: true,
  timezone_label: "America/New_York",
  slot_times: ["09:00", "11:00", "14:00", "16:00"],
  duration_minutes: 30,
  booking_horizon_days: 30,
  page_title: "Schedule with us",
};

export const normalizeBookingSettings = (
  raw: unknown,
): Required<BookingSettings> => {
  const value =
    raw != null && typeof raw === "object"
      ? (raw as Record<string, unknown>)
      : {};

  const slotTimes = Array.isArray(value.slot_times)
    ? value.slot_times
        .map((entry) => String(entry).trim())
        .filter((entry) => /^\d{2}:\d{2}$/.test(entry))
    : DEFAULT_BOOKING_SETTINGS.slot_times;

  const duration = Number(value.duration_minutes);
  const horizon = Number(value.booking_horizon_days);

  return {
    enabled: value.enabled !== false,
    timezone_label:
      typeof value.timezone_label === "string" &&
      value.timezone_label.trim().length > 0
        ? value.timezone_label.trim()
        : DEFAULT_BOOKING_SETTINGS.timezone_label,
    slot_times:
      slotTimes.length > 0 ? slotTimes : DEFAULT_BOOKING_SETTINGS.slot_times,
    duration_minutes:
      Number.isFinite(duration) && duration > 0
        ? duration
        : DEFAULT_BOOKING_SETTINGS.duration_minutes,
    booking_horizon_days:
      Number.isFinite(horizon) && horizon > 0
        ? Math.min(horizon, 90)
        : DEFAULT_BOOKING_SETTINGS.booking_horizon_days,
    page_title:
      typeof value.page_title === "string" && value.page_title.trim().length > 0
        ? value.page_title.trim()
        : DEFAULT_BOOKING_SETTINGS.page_title,
  };
};

export const formatServicePriceLabel = (input: {
  suggested_price?: number | null;
  billing_type?: string | null;
  currency?: string | null;
}) => {
  const price = Number(input.suggested_price ?? 0);
  const currency = (input.currency ?? "USD").toUpperCase();
  const formatted =
    currency === "USD"
      ? `$${price.toLocaleString("en-US", { maximumFractionDigits: 0 })}`
      : `${price} ${currency}`;

  if (input.billing_type === "recurring") {
    return "Monthly";
  }
  if (price > 0) {
    return `From ${formatted}`;
  }
  return "Quote";
};

const pad2 = (value: number) => String(value).padStart(2, "0");

export const formatDateKey = (date: Date) =>
  `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;

export const parseDateKey = (value: string) => {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim());
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(year, month - 1, day);
  if (
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day
  ) {
    return null;
  }
  return date;
};

export const listBookableDates = (horizonDays: number) => {
  const dates: string[] = [];
  const cursor = new Date();
  cursor.setHours(0, 0, 0, 0);
  let added = 0;
  while (added < horizonDays) {
    const day = cursor.getDay();
    if (day !== 0 && day !== 6) {
      dates.push(formatDateKey(cursor));
      added += 1;
    }
    cursor.setDate(cursor.getDate() + 1);
  }
  return dates;
};

export const normalizeSlotTime = (value: string) => {
  const trimmed = value.trim();
  const match = /^(\d{1,2}):(\d{2})$/.exec(trimmed);
  if (!match) return null;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) return null;
  return `${pad2(hours)}:${pad2(minutes)}`;
};

export const slotTimeToDb = (slot: string) => {
  const normalized = normalizeSlotTime(slot);
  if (!normalized) return null;
  return `${normalized}:00`;
};
