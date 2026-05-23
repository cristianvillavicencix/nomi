import {
  differenceInCalendarDays,
  format,
  isValid,
  parseISO,
  startOfToday,
} from "date-fns";

export type ProjectDeliveryStatus =
  | "none"
  | "upcoming"
  | "today"
  | "overdue"
  | "delivered";

export type ProjectDeliveryUrgency =
  | "none"
  | "comfortable"
  | "on-track"
  | "approaching"
  | "urgent"
  | "due-today"
  | "overdue"
  | "delivered";

const parseDateOnly = (value?: string | null) => {
  if (!value?.trim()) return null;
  const normalized = value.length === 10 ? value : value.slice(0, 10);
  const parsed = parseISO(normalized);
  return isValid(parsed) ? parsed : null;
};

export const getProjectDeliveryDate = (record: {
  expected_end_date?: string | null;
  expected_closing_date?: string | null;
}) => record.expected_end_date || record.expected_closing_date || null;

export const formatProjectDeliveryDate = (date?: string | null) => {
  const parsed = parseDateOnly(date);
  if (!parsed) return null;
  return format(parsed, "MMM d, yyyy");
};

const getDaysUntilDelivery = (deliveryDate?: string | null) => {
  const parsed = parseDateOnly(deliveryDate);
  if (!parsed) return null;
  return differenceInCalendarDays(parsed, startOfToday());
};

export const getProjectDeliveryUrgency = (
  deliveryDate?: string | null,
  options?: { stage?: string },
): ProjectDeliveryUrgency => {
  if (options?.stage === "delivered") return "delivered";

  const days = getDaysUntilDelivery(deliveryDate);
  if (days == null) return "none";
  if (days < 0) return "overdue";
  if (days === 0) return "due-today";
  if (days <= 3) return "urgent";
  if (days <= 7) return "approaching";
  if (days <= 14) return "on-track";
  return "comfortable";
};

export const getProjectDeliveryCountdown = (
  deliveryDate?: string | null,
  options?: { stage?: string; actualCompletionDate?: string | null },
): { label: string; status: ProjectDeliveryStatus } | null => {
  if (options?.stage === "delivered" || options?.stage === "launched") {
    const completedOn = formatProjectDeliveryDate(options.actualCompletionDate);
    return completedOn
      ? { label: `Launched ${completedOn}`, status: "delivered" }
      : { label: "Launched", status: "delivered" };
  }

  const days = getDaysUntilDelivery(deliveryDate);
  if (days == null) return null;

  if (days > 1) {
    return {
      label: `${days} days left`,
      status: days <= 7 ? "today" : "upcoming",
    };
  }
  if (days === 1) return { label: "1 day left", status: "today" };
  if (days === 0) return { label: "Due today", status: "today" };
  if (days === -1) return { label: "1 day overdue", status: "overdue" };
  return { label: `${Math.abs(days)} days overdue`, status: "overdue" };
};

export const getProjectDeliveryCountdownClassName = (
  deliveryDate?: string | null,
  options?: { stage?: string },
) =>
  getProjectDeliveryUrgencyClassName(
    getProjectDeliveryUrgency(deliveryDate, options),
  );

export const getProjectDeliveryUrgencyClassName = (
  urgency: ProjectDeliveryUrgency,
) => {
  switch (urgency) {
    case "delivered":
      return "text-emerald-700 font-medium dark:text-emerald-400";
    case "overdue":
      return "text-destructive font-bold";
    case "due-today":
      return "text-red-600 font-bold dark:text-red-400";
    case "urgent":
      return "text-orange-600 font-bold dark:text-orange-400";
    case "approaching":
      return "text-amber-600 font-semibold dark:text-amber-400";
    case "on-track":
      return "text-sky-700 font-semibold dark:text-sky-400";
    case "comfortable":
      return "text-emerald-700 font-medium dark:text-emerald-400";
    default:
      return "text-muted-foreground";
  }
};

export const getProjectDeliveryUrgencyStyles = (
  urgency: ProjectDeliveryUrgency,
) => ({
  countdown: getProjectDeliveryUrgencyClassName(urgency),
});
