const SELF_ACTIVITY_WINDOW_MS = 10_000;

const recentSelfActivityByTicket = new Map<string, number>();

const prune = () => {
  const cutoff = Date.now() - SELF_ACTIVITY_WINDOW_MS;
  for (const [ticketId, at] of recentSelfActivityByTicket) {
    if (at < cutoff) {
      recentSelfActivityByTicket.delete(ticketId);
    }
  }
};

export const markSelfTicketActivity = (ticketId: string | number) => {
  recentSelfActivityByTicket.set(String(ticketId), Date.now());
  prune();
};

export const hasRecentSelfTicketActivity = (ticketId: string | number) => {
  prune();
  const at = recentSelfActivityByTicket.get(String(ticketId));
  if (!at) return false;
  return Date.now() - at < SELF_ACTIVITY_WINDOW_MS;
};
