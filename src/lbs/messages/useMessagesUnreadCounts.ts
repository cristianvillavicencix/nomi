import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import type { Conversation, ConversationParticipant } from "@/lbs/types";
import { useInboxConversations } from "@/lbs/messages/useInboxConversations";
import {
  getUnreadCountsForConversations,
  UNREAD_COUNTS_QUERY_KEY,
} from "@/lbs/messages/getUnreadCountsForConversations";
import { formatUnreadBadgeCount } from "@/lbs/messages/messagesUnreadUtils";

export { formatUnreadBadgeCount };

export const useMessagesUnreadCounts = (
  participationsOverride?: ConversationParticipant[],
  conversationsOverride?: Conversation[],
) => {
  const inbox = useInboxConversations({
    enabled: participationsOverride == null && conversationsOverride == null,
  });

  const conversations = conversationsOverride ?? inbox.conversations;
  const conversationIds = useMemo(
    () => conversations.map((conversation) => conversation.id),
    [conversations],
  );
  const conversationIdsKey = useMemo(
    () => conversationIds.map(String).sort().join(","),
    [conversationIds],
  );

  const { data: unreadCountsById = {} } = useQuery({
    queryKey: [UNREAD_COUNTS_QUERY_KEY, conversationIdsKey],
    queryFn: () => getUnreadCountsForConversations(conversationIds),
    enabled: conversationIds.length > 0,
    staleTime: 5_000,
  });

  return useMemo(() => {
    const totalUnread = Object.values(unreadCountsById).reduce(
      (sum, count) => sum + count,
      0,
    );

    const getUnreadCount = (conversation: Conversation) =>
      unreadCountsById[String(conversation.id)] ?? 0;

    return {
      totalUnread,
      unreadCountsById,
      unreadByConversationId: Object.fromEntries(
        Object.entries(unreadCountsById).filter(([, count]) => count > 0),
      ),
      getUnreadCount,
      isConversationUnread: (conversation: Conversation) =>
        getUnreadCount(conversation) > 0,
    };
  }, [unreadCountsById]);
};
