export type InvoiceSendSchedulePreset =
  | "tomorrow"
  | "end_of_week"
  | "end_of_month"
  | "custom";

export const DEFAULT_INVOICE_SEND_TIME = "08:00";

const pad2 = (value: number) => String(value).padStart(2, "0");

export const formatScheduleDateLabel = (date: Date) => {
  const year = date.getFullYear();
  const month = pad2(date.getMonth() + 1);
  const day = pad2(date.getDate());
  return `${year}-${month}-${day}`;
};

export const parseSendTime = (value: string) => {
  const match = /^(\d{1,2}):(\d{2})$/.exec(value.trim());
  if (!match) return { hours: 8, minutes: 0 };
  return {
    hours: Math.min(Math.max(Number(match[1]), 0), 23),
    minutes: Math.min(Math.max(Number(match[2]), 0), 59),
  };
};

export const formatSendTime = (hours: number, minutes: number) =>
  `${pad2(hours)}:${pad2(minutes)}`;

export const combineDateAndSendTime = (date: Date, sendTime: string) => {
  const { hours, minutes } = parseSendTime(sendTime);
  const combined = new Date(date);
  combined.setHours(hours, minutes, 0, 0);
  return combined;
};

export const scheduleDateForPreset = (
  preset: InvoiceSendSchedulePreset,
  customDate?: string,
  from = new Date(),
) => {
  const base = new Date(from);
  base.setHours(0, 0, 0, 0);

  if (preset === "tomorrow") {
    base.setDate(base.getDate() + 1);
    return base;
  }

  if (preset === "end_of_week") {
    const day = base.getDay();
    const daysToSunday = day === 0 ? 0 : 7 - day;
    base.setDate(base.getDate() + daysToSunday);
    return base;
  }

  if (preset === "end_of_month") {
    return new Date(base.getFullYear(), base.getMonth() + 1, 0);
  }

  if (customDate) {
    const parsed = new Date(`${customDate}T12:00:00`);
    if (!Number.isNaN(parsed.getTime())) {
      parsed.setHours(0, 0, 0, 0);
      return parsed;
    }
  }

  return base;
};

export const formatSendTimeDisplay = (sendTime: string) => {
  const { hours, minutes } = parseSendTime(sendTime);
  const period = hours >= 12 ? "PM" : "AM";
  const hour12 = hours % 12 || 12;
  return `${hour12}:${pad2(minutes)} ${period}`;
};
