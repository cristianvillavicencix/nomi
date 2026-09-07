import { toneBadgeVariant, type Tone } from "@/modules/shared/status";

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

export const ticketStatusLabel = (status: string) => status.replace(/_/g, " ");

export const ticketStatusTone = (status: string): Tone => {
  switch (status) {
    case "new":
      return "info";
    case "open":
      return "success";
    case "waiting":
      return "warning";
    default:
      return "muted";
  }
};

export const ticketStatusVariant = (status: string) =>
  toneBadgeVariant(ticketStatusTone(status));

export const formatTicketRelativeTime = (value?: string | null) => {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  const diffMs = Date.now() - date.getTime();
  const minutes = Math.floor(diffMs / (1000 * 60));
  if (minutes < 1) return "just now";
  if (minutes < 60) {
    return minutes === 1 ? "1 minute ago" : `${minutes} minutes ago`;
  }
  const hours = Math.floor(minutes / 60);
  if (hours < 24) {
    return hours === 1 ? "1 hour ago" : `${hours} hours ago`;
  }
  const days = Math.floor(hours / 24);
  if (days < 7) {
    return days === 1 ? "1 day ago" : `${days} days ago`;
  }
  return date.toLocaleDateString();
};
