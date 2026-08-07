import type { BillingReportPeriodId } from "@/modules/billing/reports/reportsNavigation";

export type ReportDateRange = {
  start: Date;
  end: Date;
  label: string;
};

const startOfDay = (date: Date) =>
  new Date(date.getFullYear(), date.getMonth(), date.getDate());

const endOfDay = (date: Date) =>
  new Date(date.getFullYear(), date.getMonth(), date.getDate(), 23, 59, 59, 999);

const startOfMonth = (date: Date) =>
  new Date(date.getFullYear(), date.getMonth(), 1);

const startOfQuarter = (date: Date) => {
  const quarter = Math.floor(date.getMonth() / 3);
  return new Date(date.getFullYear(), quarter * 3, 1);
};

const startOfYear = (date: Date) => new Date(date.getFullYear(), 0, 1);

export const getReportDateRange = (
  period: BillingReportPeriodId,
  referenceDate = new Date(),
): ReportDateRange => {
  const end = endOfDay(referenceDate);
  const today = startOfDay(referenceDate);

  switch (period) {
    case "7d": {
      const start = new Date(today);
      start.setDate(start.getDate() - 6);
      return { start, end, label: "Last 7 days" };
    }
    case "30d": {
      const start = new Date(today);
      start.setDate(start.getDate() - 29);
      return { start, end, label: "Last 30 days" };
    }
    case "90d": {
      const start = new Date(today);
      start.setDate(start.getDate() - 89);
      return { start, end, label: "Last 90 days" };
    }
    case "month":
      return {
        start: startOfDay(startOfMonth(referenceDate)),
        end,
        label: "This month",
      };
    case "quarter":
      return {
        start: startOfDay(startOfQuarter(referenceDate)),
        end,
        label: "This quarter",
      };
    case "year":
      return {
        start: startOfDay(startOfYear(referenceDate)),
        end,
        label: "This year",
      };
    case "ytd":
    default:
      return {
        start: startOfDay(startOfYear(referenceDate)),
        end,
        label: "Year to date",
      };
  }
};

export const formatReportRangeDocumentLabel = (range: ReportDateRange) => {
  const format = (date: Date) =>
    date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  return `From ${format(range.start)} To ${format(range.end)}`;
};

export const parseReportDate = (value?: string | null) => {
  if (!value?.trim()) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

export const isDateWithinRange = (
  value: string | null | undefined,
  range: ReportDateRange,
) => {
  const parsed = parseReportDate(value);
  if (!parsed) return false;
  return parsed >= range.start && parsed <= range.end;
};

export const formatReportMonthKey = (date: Date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;

export const formatReportMonthLabel = (monthKey: string) => {
  const [year, month] = monthKey.split("-").map(Number);
  if (!year || !month) return monthKey;
  return new Date(year, month - 1, 1).toLocaleDateString(undefined, {
    month: "short",
    year: "2-digit",
  });
};

export const formatReportDayKey = (date: Date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;

export const formatReportDayLabel = (dayKey: string) => {
  const parsed = parseReportDate(`${dayKey}T12:00:00`);
  if (!parsed) return dayKey;
  return parsed.toLocaleDateString(undefined, { month: "short", day: "numeric" });
};
