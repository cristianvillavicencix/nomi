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
