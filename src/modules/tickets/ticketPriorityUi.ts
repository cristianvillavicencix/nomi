import type { Ticket } from "@/modules/types";
import { toneClass, type Tone } from "@/modules/shared/status";

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

export const ticketPriorityTone = (priority?: string | null): Tone => {
  switch (priority?.trim().toLowerCase()) {
    case "urgent":
      return "destructive";
    case "high":
      return "warning";
    default:
      return "muted";
  }
};

export const ticketPriorityClassName = (priority?: string | null) =>
  toneClass(ticketPriorityTone(priority), "border");

export const isElevatedTicketPriority = (ticket: Pick<Ticket, "priority">) => {
  const value = ticket.priority?.trim().toLowerCase();
  return value === "high" || value === "urgent";
};
