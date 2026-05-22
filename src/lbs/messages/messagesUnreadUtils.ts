import type { Identifier } from "ra-core";
import type { Conversation, ConversationParticipant } from "@/lbs/types";
import { getLocalLastReadMap } from "@/lbs/messages/messagesReadStorage";

export const getConversationReadAt = (
  conversationId: Identifier,
  participations: ConversationParticipant[],
  localReadMap: Record<string, string> = getLocalLastReadMap(),
) => {
  const participant = participations.find(
    (entry) => String(entry.conversation_id) === String(conversationId),
  );
  const fromParticipant = participant?.last_read_at ?? null;
  const fromLocal = localReadMap[String(conversationId)] ?? null;
  if (!fromParticipant && !fromLocal) return null;
  if (!fromParticipant) return fromLocal;
  if (!fromLocal) return fromParticipant;
  return Date.parse(fromParticipant) >= Date.parse(fromLocal) ? fromParticipant : fromLocal;
};

export const isConversationUnread = (
  conversation: Conversation,
  participations: ConversationParticipant[],
  localReadMap: Record<string, string> = getLocalLastReadMap(),
) => {
  if (!conversation.last_message_at) return false;
  const readAt = getConversationReadAt(conversation.id, participations, localReadMap);
  if (!readAt) return true;
  return Date.parse(conversation.last_message_at) > Date.parse(readAt);
};

export const computeUnreadConversationCounts = (
  conversations: Conversation[],
  participations: ConversationParticipant[],
  localReadMap: Record<string, string> = getLocalLastReadMap(),
) => {
  const unreadByConversationId: Record<string, boolean> = {};
  let totalUnread = 0;

  for (const conversation of conversations) {
    if (!isConversationUnread(conversation, participations, localReadMap)) continue;
    unreadByConversationId[String(conversation.id)] = true;
    totalUnread += 1;
  }

  return { totalUnread, unreadByConversationId };
};

export const formatUnreadBadgeCount = (count: number) =>
  count > 99 ? "99+" : String(count);
