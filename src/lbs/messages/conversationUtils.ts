import type { Identifier } from "ra-core";
import type { ConversationType } from "@/lbs/types";

export const buildDmKey = (memberA: Identifier, memberB: Identifier) =>
  [String(memberA), String(memberB)].sort().join(":");

export const getConversationTypeLabel = (type: ConversationType) => {
  if (type === "team_dm") return "Direct message";
  if (type === "project") return "Project team";
  if (type === "client") return "Client";
  return type;
};

export const buildMessagePreview = (message: {
  body?: string | null;
  media_url?: string | null;
  is_internal_note?: boolean | null;
}) => {
  if (message.is_internal_note) {
    return message.body?.trim() || "Internal note";
  }
  if (message.media_url) {
    return message.body?.trim() || "Sent an attachment";
  }
  return message.body?.trim() || "New message";
};

export const formatMessageTime = (value?: string | null) => {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  const now = new Date();
  const sameDay =
    date.getFullYear() === now.getFullYear() &&
    date.getMonth() === now.getMonth() &&
    date.getDate() === now.getDate();

  if (sameDay) {
    return date.toLocaleTimeString(undefined, {
      hour: "numeric",
      minute: "2-digit",
    });
  }

  return date.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
};

export const sortConversationsByActivity = <
  T extends {
    last_message_at?: string | null;
    updated_at?: string | null;
    id: unknown;
  },
>(
  conversations: T[],
) =>
  [...conversations].sort((left, right) => {
    const leftKey = left.last_message_at ?? left.updated_at ?? "";
    const rightKey = right.last_message_at ?? right.updated_at ?? "";
    const diff = rightKey.localeCompare(leftKey);
    return diff !== 0 ? diff : String(right.id).localeCompare(String(left.id));
  });
