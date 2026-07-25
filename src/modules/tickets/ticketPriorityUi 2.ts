import type { Ticket } from "@/modules/types";

export const ticketPriorityLabel = (priority?: string | null) => {
  switch (priority?.trim().toLowerCase()) {
    case "urgent":
      return "Urgent";
    case "high":
      return "High";
    case "low":
      return "Low";
    default:
      return null;
  }
};

export const ticketPriorityClassName = (priority?: string | null) => {
  switch (priority?.trim().toLowerCase()) {
    case "urgent":
      return "border-destructive/40 bg-destructive/10 text-destructive";
    case "high":
      return "border-orange-500/40 bg-orange-500/10 text-orange-700 dark:text-orange-300";
    case "low":
      return "border-border bg-muted/40 text-muted-foreground";
    default:
      return "";
  }
};

export const isElevatedTicketPriority = (ticket: Pick<Ticket, "priority">) => {
  const value = ticket.priority?.trim().toLowerCase();
  return value === "high" || value === "urgent";
};
