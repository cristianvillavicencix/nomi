import { ticketStatusLabel } from "@/modules/tickets/ticketInboxConfig";
import { formatDurationShort } from "@/modules/tickets/ticketInboxUi";
import { toneClass } from "@/modules/shared/status";

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
  return toneClass("warning", "border");
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
      ? toneClass("warning", "border")
      : toneClass("muted", "border");
  }
  if (status === "resolved") {
    return toneClass("success", "border");
  }
  return toneClass("muted", "border");
};
