export const DEFAULT_TICKET_INBOX_EMAIL =
  import.meta.env.VITE_TICKET_INBOX_EMAIL?.trim() || "supplements@lbs.bz";

export const TICKET_STATUS_FILTERS = [
  { id: "all", label: "All" },
  { id: "new", label: "New" },
  { id: "open", label: "Open" },
  { id: "waiting", label: "Waiting" },
  { id: "resolved", label: "Resolved" },
] as const;

export type TicketStatusFilterId = (typeof TICKET_STATUS_FILTERS)[number]["id"];

export const ticketStatusLabel = (status: string) =>
  status.replace(/_/g, " ");

export const ticketStatusVariant = (status: string) => {
  switch (status) {
    case "new":
      return "default" as const;
    case "open":
      return "secondary" as const;
    case "waiting":
      return "outline" as const;
    case "resolved":
      return "outline" as const;
    default:
      return "outline" as const;
  }
};

export const formatTicketRelativeTime = (value?: string | null) => {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  const diffMs = Date.now() - date.getTime();
  const hours = Math.floor(diffMs / (1000 * 60 * 60));
  if (hours < 1) return "now";
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d`;
  return date.toLocaleDateString();
};
