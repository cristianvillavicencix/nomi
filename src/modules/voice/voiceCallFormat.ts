export const formatCallDuration = (seconds: number | null | undefined) => {
  if (seconds == null || !Number.isFinite(seconds) || seconds <= 0) {
    return "—";
  }
  const total = Math.floor(seconds);
  const minutes = Math.floor(total / 60);
  const remainder = total % 60;
  return `${minutes}:${String(remainder).padStart(2, "0")}`;
};

const STATUS_LABELS: Record<string, string> = {
  queued: "Queued",
  ringing: "Ringing",
  "in-progress": "In progress",
  completed: "Completed",
  failed: "Failed",
  busy: "Busy",
  "no-answer": "No answer",
  canceled: "Canceled",
};

export const voiceCallStatusLabel = (status: string | null | undefined) =>
  STATUS_LABELS[status?.trim().toLowerCase() ?? ""] ?? status ?? "Unknown";

export const formatCallTimestamp = (value: string | null | undefined) => {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
};
