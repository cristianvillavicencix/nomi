export const ACTIVE_TICKET_STATUSES = ["new", "open", "waiting"] as const;

export type TicketWorkflowStatus =
  | (typeof ACTIVE_TICKET_STATUSES)[number]
  | "resolved";

export const requiresTicketStatusNote = (
  fromStatus: string,
  toStatus: string,
  options?: { required?: boolean },
) => {
  if (options?.required === false) return false;
  if (fromStatus === toStatus) return false;
  if (toStatus === "waiting" || toStatus === "resolved") return true;
  if (fromStatus === "resolved") return true;
  return false;
};

export const getTicketStatusNotePrompt = (
  fromStatus: string,
  toStatus: string,
) => {
  if (toStatus === "waiting") {
    return "Why is this ticket waiting? Add an internal note for the team.";
  }
  if (toStatus === "resolved") {
    return "Why is this ticket resolved? Add an internal note for the team.";
  }
  if (fromStatus === "resolved") {
    return "Why are you reopening this ticket? Add an internal note for the team.";
  }
  return "Add an internal note explaining this status change.";
};

export const buildTicketInboxStatusFilter = (
  status: "all" | TicketWorkflowStatus,
) => {
  if (status === "all") {
    return { "status@neq": "resolved" };
  }
  return { "status@eq": status };
};

export const countTicketsByInboxFilter = (
  tickets: Array<{ status?: string | null; merged_into_ticket_id?: unknown }>,
) => {
  const base = { all: 0, new: 0, open: 0, waiting: 0, resolved: 0 };
  for (const ticket of tickets) {
    if (ticket.merged_into_ticket_id) continue;
    const status = ticket.status ?? "";
    if (status === "resolved") {
      base.resolved += 1;
      continue;
    }
    base.all += 1;
    if (status === "new") base.new += 1;
    if (status === "open") base.open += 1;
    if (status === "waiting") base.waiting += 1;
  }
  return base;
};
