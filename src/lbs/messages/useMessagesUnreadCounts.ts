import { useMemo } from "react";
import type { Conversation, ConversationParticipant } from "@/lbs/types";
import { useInboxConversations } from "@/lbs/messages/useInboxConversations";
import { useMessagesQuickAccessOptional } from "@/lbs/messages/messagesQuickAccessContext";
import {
  computeUnreadConversationCounts,
  isConversationUnread,
} from "@/lbs/messages/messagesUnreadUtils";
import { getLocalLastReadMap } from "@/lbs/messages/messagesReadStorage";

export const useMessagesUnreadCounts = (
  participationsOverride?: ConversationParticipant[],
  conversationsOverride?: Conversation[],
) => {
  const messagesQuickAccess = useMessagesQuickAccessOptional();
  const inbox = useInboxConversations({
    enabled: participationsOverride == null && conversationsOverride == null,
  });

  const participations = participationsOverride ?? inbox.participations;
  const conversations = conversationsOverride ?? inbox.conversations;

  const localReadMap = useMemo(() => {
    void messagesQuickAccess?.localReadVersion;
    return getLocalLastReadMap();
  }, [messagesQuickAccess?.localReadVersion]);

  return useMemo(
    () => ({
      ...computeUnreadConversationCounts(conversations, participations, localReadMap),
      isConversationUnread: (conversation: Conversation) =>
        isConversationUnread(conversation, participations, localReadMap),
    }),
    [conversations, localReadMap, participations],
  );
};
