import { useMemo } from "react";
import type { Conversation, ConversationParticipant } from "@/lbs/types";
import { useInboxConversations } from "@/lbs/messages/useInboxConversations";
import {
  computeUnreadConversationCounts,
  isConversationUnread,
} from "@/lbs/messages/messagesUnreadUtils";

export const useMessagesUnreadCounts = (
  participationsOverride?: ConversationParticipant[],
  conversationsOverride?: Conversation[],
) => {
  const inbox = useInboxConversations({
    enabled: participationsOverride == null && conversationsOverride == null,
  });

  const participations = participationsOverride ?? inbox.participations;
  const conversations = conversationsOverride ?? inbox.conversations;

  return useMemo(
    () => ({
      ...computeUnreadConversationCounts(conversations, participations),
      isConversationUnread: (conversation: Conversation) =>
        isConversationUnread(conversation, participations),
    }),
    [conversations, participations],
  );
};
