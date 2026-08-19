import { differenceInCalendarDays, parseISO } from "date-fns";
import { todayIso } from "@/modules/billing/billingDisplayUtils";

/** Compact status line for the invoice sidebar (Zoho-style). */
export const invoiceStatusSidebarLabel = (
  status?: string | null,
  dueDate?: string | null,
  options?: { isPartial?: boolean },
) => {
  const normalized = status?.toLowerCase() ?? "";

  let label = status?.replace(/_/g, " ") ?? "—";
  if (normalized === "draft") label = "Draft";
  else if (normalized === "paid") label = "Paid";
  else if (normalized === "void") label = "Void";
  else if (normalized === "sent" && dueDate) {
    const today = parseISO(todayIso());
    const due = parseISO(dueDate);
    const days = differenceInCalendarDays(due, today);
    if (days < 0) {
      const overdue = Math.abs(days);
      label =
        overdue === 1 ? "Overdue by 1 day" : `Overdue by ${overdue} days`;
    } else if (days === 0) label = "Due today";
    else if (days === 1) label = "Due in 1 day";
    else label = `Due in ${days} days`;
  } else if (normalized === "sent") label = "Sent";

  if (options?.isPartial && normalized !== "paid" && normalized !== "void") {
    return `Partial · ${label}`;
  }
  return label;
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
