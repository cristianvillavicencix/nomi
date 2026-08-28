import { ticketStatusLabel } from "@/modules/tickets/ticketInboxConfig";
import { formatDurationShort } from "@/modules/tickets/ticketInboxUi";

const WAITING_SLA_HOURS = 48;

export const getTicketWaitingDurationLabel = (
  status?: string | null,
  updatedAt?: string | null,
) => {
  if (status !== "waiting" || !updatedAt) return null;
  const updated = new Date(updatedAt);
  if (Number.isNaN(updated.getTime())) return null;

  const hours = (Date.now() - updated.getTime()) / (1000 * 60 * 60);
  if (hours < WAITING_SLA_HOURS) return null;

  const days = Math.floor(hours / 24);
  if (days >= 1) {
    return days === 1 ? "Waiting 1d" : `Waiting ${days}d`;
  }
  return `Waiting ${Math.floor(hours)}h`;
};

export const ticketWaitingSlaClassName = (
  status?: string | null,
  updatedAt?: string | null,
) => {
  if (!getTicketWaitingDurationLabel(status, updatedAt)) return "";
  return "border-amber-500/40 bg-amber-500/10 text-amber-800 dark:text-amber-200";
};

/** Time spent in the current ticket status (from updated_at). */
export const getTicketStatusDurationLabel = (
  status?: string | null,
  updatedAt?: string | null,
) => {
  if (!status?.trim() || !updatedAt) return null;
  const updated = new Date(updatedAt);
  if (Number.isNaN(updated.getTime())) return null;

  const duration = formatDurationShort(Date.now() - updated.getTime());
  if (!duration) return null;

  const statusName = ticketStatusLabel(status.trim());
  const title =
    statusName.charAt(0).toUpperCase() + statusName.slice(1).toLowerCase();
  return `${title} · ${duration}`;
};

export const ticketStatusDurationClassName = (
  status?: string | null,
  updatedAt?: string | null,
) => {
  if (!getTicketStatusDurationLabel(status, updatedAt)) return "";
  if (status === "waiting") {
    return getTicketWaitingDurationLabel(status, updatedAt)
      ? "border-amber-500/40 bg-amber-500/10 text-amber-800 dark:text-amber-200"
      : "border-border bg-muted/40 text-muted-foreground";
  }
  if (status === "resolved") {
    return "border-emerald-500/30 bg-emerald-500/5 text-emerald-800 dark:text-emerald-200";
  }
  return "border-border bg-muted/40 text-muted-foreground";
};
