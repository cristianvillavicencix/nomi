import { ticketStatusLabel } from "@/modules/tickets/ticketInboxConfig";
import type { TicketWorkflowStatus } from "@/modules/tickets/ticketStatusWorkflow";

export type TicketReplyStatusAction = {
  status: TicketWorkflowStatus;
  label: string;
  primary: boolean;
};

const formatReplyStatusLabel = (status: TicketWorkflowStatus) => {
  const raw = ticketStatusLabel(status);
  return raw.charAt(0).toUpperCase() + raw.slice(1);
};

const action = (
  status: TicketWorkflowStatus,
  primary: boolean,
): TicketReplyStatusAction => ({
  status,
  label: `Reply & ${formatReplyStatusLabel(status)}`,
  primary,
});

export const getPrimaryTicketReplyStatusAction = (
  currentStatus: string | null | undefined,
) =>
  getTicketReplyStatusActions(currentStatus).find((action) => action.primary) ??
  getTicketReplyStatusActions(currentStatus)[0];

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

export const getTicketReplyStatusActions = (
  currentStatus: string | null | undefined,
): TicketReplyStatusAction[] => {
  switch (currentStatus) {
    case "new":
      return [action("open", true), action("waiting", false), action("resolved", false)];
    case "open":
      return [action("open", true), action("waiting", false), action("resolved", false)];
    case "waiting":
      return [
        action("waiting", true),
        action("open", false),
        action("resolved", false),
      ];
    case "resolved":
      return [action("open", true), action("resolved", false)];
    default:
      return [action("open", true), action("waiting", false), action("resolved", false)];
  }
};
