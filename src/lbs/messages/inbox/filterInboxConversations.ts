import type { Identifier } from "ra-core";
import type { Conversation, ConversationParticipant } from "@/lbs/types";
import type {
  InboxFilterState,
  InboxTab,
} from "@/lbs/messages/messagesHubTypes";
import { isConversationUnread } from "@/lbs/messages/messagesUnreadUtils";

export const filterInboxConversations = (
  conversations: Conversation[],
  tab: InboxTab,
  filters: InboxFilterState,
  options: {
    currentMemberId?: Identifier;
    participations: ConversationParticipant[];
  },
) => {
  const { currentMemberId, participations } = options;
  const query = filters.query.trim().toLowerCase();

  return conversations.filter((conversation) => {
    if (tab === "sms" && conversation.type !== "client") return false;
    if (
      tab === "team" &&
      conversation.type !== "team_dm" &&
      conversation.type !== "project"
    ) {
      return false;
    }
    if (tab === "mine") {
      const isAssignee =
        currentMemberId != null &&
        String(conversation.assignee_member_id) === String(currentMemberId);
      const isCreator =
        currentMemberId != null &&
        String(conversation.created_by_member_id) === String(currentMemberId);
      if (!isAssignee && !isCreator) return false;
    }
    if (
      tab === "unread" &&
      !isConversationUnread(conversation, participations)
    ) {
      return false;
    }

    if (
      filters.status !== "all" &&
      (conversation.status ?? "open") !== filters.status
    ) {
      return false;
    }

    if (filters.assigneeMemberId === "mine") {
      if (String(conversation.assignee_member_id) !== String(currentMemberId))
        return false;
    } else if (
      filters.assigneeMemberId !== "all" &&
      String(conversation.assignee_member_id) !== filters.assigneeMemberId
    ) {
      return false;
    }

    if (filters.tag !== "all") {
      const tags = conversation.tags ?? [];
      if (!tags.includes(filters.tag)) return false;
    }

    if (query) {
      const haystack = [
        conversation.title,
        conversation.external_phone,
        ...(conversation.tags ?? []),
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      if (!haystack.includes(query)) return false;
    }

    return true;
  });
};
