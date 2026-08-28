export const formatTicketListTime = (value?: string | null) => {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  const diffMs = Date.now() - date.getTime();
  const minutes = Math.floor(diffMs / (1000 * 60));
  if (minutes < 1) return "now";
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d`;
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
};

import type { TicketMessage } from "@/modules/types";

export const formatDurationShort = (ms: number) => {
  if (!Number.isFinite(ms) || ms < 0) return null;
  const minutes = Math.floor(ms / (1000 * 60));
  if (minutes < 1) return "< 1m";
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  const remMin = minutes % 60;
  if (hours < 24) {
    return remMin > 0 ? `${hours}h ${remMin}m` : `${hours}h`;
  }
  const days = Math.floor(hours / 24);
  const remHours = hours % 24;
  return remHours > 0 ? `${days}d ${remHours}h` : `${days}d`;
};

/** Time from the latest prior inbound message to this outbound reply. */
export const getReplyDurationLabel = (
  outbound: TicketMessage,
  messages: TicketMessage[],
) => {
  if (outbound.direction !== "outbound") return null;
  const outboundTime = outbound.created_at
    ? new Date(outbound.created_at).getTime()
    : NaN;
  if (!Number.isFinite(outboundTime)) return null;

  let priorInboundTime = -Infinity;
  for (const message of messages) {
    if (message.direction !== "inbound") continue;
    const inboundTime = message.created_at
      ? new Date(message.created_at).getTime()
      : NaN;
    if (!Number.isFinite(inboundTime) || inboundTime >= outboundTime) continue;
    if (inboundTime > priorInboundTime) priorInboundTime = inboundTime;
  }
  if (!Number.isFinite(priorInboundTime) || priorInboundTime <= 0) return null;

  const duration = formatDurationShort(outboundTime - priorInboundTime);
  return duration ? `Replied in ${duration}` : null;
};

export const formatTicketMessageTime = (value?: string | null) => {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;

  const now = new Date();
  const time = date.toLocaleTimeString(undefined, {
    hour: "numeric",
    minute: "2-digit",
  });

  if (date.toDateString() === now.toDateString()) {
    return `Today ${time}`;
  }

  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  if (date.toDateString() === yesterday.toDateString()) {
    return `Yesterday ${time}`;
  }

  return date.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
};

export const getTicketClaimLabel = (ticket: {
  id: string | number;
  deal_id?: string | number | null;
}) => (ticket.deal_id ? `Claim #${ticket.deal_id}` : `Ticket #${ticket.id}`);

export const getTicketListTitle = (
  ticket: {
    id: string | number;
    deal_id?: string | number | null;
    requester_name?: string | null;
    requester_email?: string | null;
  },
  companyName?: string | null,
) => {
  const primary =
    companyName?.trim() ||
    ticket.requester_name?.trim() ||
    ticket.requester_email?.trim() ||
    "Unknown sender";
  return `${primary} — ${getTicketClaimLabel(ticket)}`;
};

export const getTicketSlaLabel = (ticket: {
  status: string;
  updated_at?: string | null;
}) => {
  if (!ticket.updated_at) return null;
  if (ticket.status !== "waiting" && ticket.status !== "new") return null;

  const date = new Date(ticket.updated_at);
  if (Number.isNaN(date.getTime())) return null;

  const hours = Math.floor((Date.now() - date.getTime()) / (1000 * 60 * 60));
  if (hours < 24) return null;

  const days = Math.floor(hours / 24);
  return `SLA ${days}d`;
};

export const memberDisplayName = (
  member?: {
    first_name?: string | null;
    last_name?: string | null;
    email?: string | null;
    id?: string | number;
  } | null,
) => {
  if (!member) return null;
  const name = [member.first_name, member.last_name].filter(Boolean).join(" ");
  return (
    name || member.email || (member.id != null ? `Member #${member.id}` : null)
  );
};
