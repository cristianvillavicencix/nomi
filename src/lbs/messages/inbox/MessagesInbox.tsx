import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import type { Identifier } from "ra-core";
import type {
  Contact,
  Conversation,
  ConversationParticipant,
  LbsDeal,
  OrganizationMember,
} from "@/lbs/types";
import { MessagesInboxPanel } from "@/lbs/messages/MessagesInboxPanel";
import { InboxTabs } from "@/lbs/messages/inbox/InboxTabs";
import { InboxFilters } from "@/lbs/messages/inbox/InboxFilters";
import { filterInboxConversations } from "@/lbs/messages/inbox/filterInboxConversations";
import {
  DEFAULT_INBOX_FILTERS,
  type InboxFilterState,
  type InboxTab,
} from "@/lbs/messages/messagesHubTypes";
import { useMessagesQuickAccessOptional } from "@/lbs/messages/messagesQuickAccessContext";
import { useMessagesUnreadCounts } from "@/lbs/messages/useMessagesUnreadCounts";
import { getLocalLastReadMap } from "@/lbs/messages/messagesReadStorage";

export const MessagesInbox = (props: {
  conversations: Conversation[];
  deals: LbsDeal[];
  dmParticipants: ConversationParticipant[];
  members: OrganizationMember[];
  contacts?: Contact[];
  currentMemberId?: Identifier;
  selectedConversationId?: Identifier;
  onSelectConversation: (conversation: Conversation) => void;
  isPending: boolean;
  compact?: boolean;
}) => {
  const [activeTab, setActiveTab] = useState<InboxTab>("all");
  const [filters, setFilters] = useState<InboxFilterState>(DEFAULT_INBOX_FILTERS);
  const messagesQuickAccess = useMessagesQuickAccessOptional();
  const unread = useMessagesUnreadCounts(
    props.dmParticipants,
    props.conversations,
  );

  const localReadMap = useMemo(() => {
    void messagesQuickAccess?.localReadVersion;
    return getLocalLastReadMap();
  }, [messagesQuickAccess?.localReadVersion]);

  const filteredConversations = useMemo(
    () =>
      filterInboxConversations(props.conversations, activeTab, filters, {
        currentMemberId: props.currentMemberId,
        participations: props.dmParticipants,
        localReadMap,
      }),
    [
      activeTab,
      filters,
      localReadMap,
      props.conversations,
      props.currentMemberId,
      props.dmParticipants,
    ],
  );

  const tabCounts = useMemo(
    () => ({
      sms: props.conversations.filter((c) => c.type === "client").length,
      team: props.conversations.filter(
        (c) => c.type === "team_dm" || c.type === "project",
      ).length,
      unread: unread.totalUnread,
    }),
    [props.conversations, unread.totalUnread],
  );

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <InboxTabs activeTab={activeTab} onChange={setActiveTab} counts={tabCounts} />
      <div className="px-3 py-2">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={filters.query}
            onChange={(event) => setFilters((current) => ({ ...current, query: event.target.value }))}
            placeholder="Search conversations…"
            className="h-9 pl-9"
          />
        </div>
      </div>
      <InboxFilters filters={filters} onChange={setFilters} members={props.members} />
      <MessagesInboxPanel
        {...props}
        conversations={filteredConversations}
      />
    </div>
  );
};
