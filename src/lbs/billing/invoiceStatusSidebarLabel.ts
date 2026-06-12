import { differenceInCalendarDays, parseISO } from "date-fns";
import { todayIso } from "@/lbs/billing/billingDisplayUtils";

/** Compact status line for the invoice sidebar (Zoho-style). */
export const invoiceStatusSidebarLabel = (
  status?: string | null,
  dueDate?: string | null,
) => {
  const normalized = status?.toLowerCase() ?? "";

  if (normalized === "draft") return "Draft";
  if (normalized === "paid") return "Paid";
  if (normalized === "void") return "Void";
  if (normalized === "sent" && dueDate) {
    const today = parseISO(todayIso());
    const due = parseISO(dueDate);
    const days = differenceInCalendarDays(due, today);
    if (days < 0) {
      const overdue = Math.abs(days);
      return overdue === 1 ? "Overdue by 1 day" : `Overdue by ${overdue} days`;
    }
    if (days === 0) return "Due today";
    if (days === 1) return "Due in 1 day";
    return `Due in ${days} days`;
  }
  if (normalized === "sent") return "Sent";
  return status?.replace(/_/g, " ") ?? "—";
};

export const invoiceStatusSidebarVariant = (
  status?: string | null,
  dueDate?: string | null,
): "default" | "secondary" | "destructive" | "outline" => {
  const normalized = status?.toLowerCase() ?? "";
  if (normalized === "paid") return "default";
  if (normalized === "void" || normalized === "draft") return "outline";
  if (normalized === "sent" && dueDate && dueDate < todayIso()) {
    return "destructive";
  }
  if (normalized === "sent") return "secondary";
  return "outline";
};
