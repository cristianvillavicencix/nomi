import { useMemo } from "react";
import { useGetIdentity } from "ra-core";
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
  const { identity } = useGetIdentity();

  const participations = participationsOverride ?? inbox.participations;
  const conversations = conversationsOverride ?? inbox.conversations;
  const currentMemberId = identity?.id;

  return useMemo(
    () => ({
      ...computeUnreadConversationCounts(
        conversations,
        participations,
        currentMemberId,
      ),
      isConversationUnread: (conversation: Conversation) =>
        isConversationUnread(conversation, participations, currentMemberId),
    }),
    [conversations, currentMemberId, participations],
  );
};
