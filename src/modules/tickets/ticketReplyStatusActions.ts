import { ticketStatusLabel } from "@/modules/tickets/ticketInboxConfig";
import type { TicketWorkflowStatus } from "@/modules/tickets/ticketStatusWorkflow";

export type TicketReplyStatusTransition = {
  status: TicketWorkflowStatus;
  label: string;
};

const REPLY_TRANSITION_STATUSES: TicketWorkflowStatus[] = [
  "open",
  "waiting",
  "resolved",
];

const formatReplyStatusLabel = (status: TicketWorkflowStatus) => {
  const raw = ticketStatusLabel(status);
  return raw.charAt(0).toUpperCase() + raw.slice(1);
};

export const normalizeTicketWorkflowStatus = (
  currentStatus: string | null | undefined,
): TicketWorkflowStatus => {
  if (
    currentStatus === "new" ||
    currentStatus === "open" ||
    currentStatus === "waiting" ||
    currentStatus === "resolved"
  ) {
    return currentStatus;
  }
  return "open";
};

/** Status-changing send options for the reply chevron menu (excludes current status). */
export const getTicketReplyStatusTransitions = (
  currentStatus: string | null | undefined,
): TicketReplyStatusTransition[] => {
  const normalized = normalizeTicketWorkflowStatus(currentStatus);
  return REPLY_TRANSITION_STATUSES.filter((status) => status !== normalized).map(
    (status) => ({
      status,
      label: `Send & ${formatReplyStatusLabel(status)}`,
    }),
  );
};

export const ticketReplyStatusDotClass = (status: TicketWorkflowStatus) => {
  switch (status) {
    case "new":
    case "open":
      return "bg-success";
    case "waiting":
      return "bg-warning";
    case "resolved":
      return "bg-muted-foreground/70";
    default:
      return "bg-muted-foreground/70";
  }
};
