import { useRef } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import type { Identifier } from "ra-core";
import type {
  Contact,
  Conversation,
  ConversationParticipant,
  LbsDeal,
  OrganizationMember,
} from "@/lbs/types";
import { ConversationListItem } from "@/lbs/messages/ConversationListItem";
import { cn } from "@/lib/utils";

export const InboxList = ({
  conversations,
  deals,
  dmParticipants,
  members,
  contacts = [],
  currentMemberId,
  selectedConversationId,
  onSelectConversation,
  isConversationUnread,
  getUnreadCount,
  onLoadMore,
  hasMore,
  loadingMore,
}: {
  conversations: Conversation[];
  deals: LbsDeal[];
  dmParticipants: ConversationParticipant[];
  members: OrganizationMember[];
  contacts?: Contact[];
  currentMemberId?: Identifier;
  selectedConversationId?: Identifier | null;
  onSelectConversation: (conversation: Conversation) => void;
  isConversationUnread: (conversation: Conversation) => boolean;
  getUnreadCount?: (conversation: Conversation) => number;
  onLoadMore?: () => void;
  hasMore?: boolean;
  loadingMore?: boolean;
}) => {
  const parentRef = useRef<HTMLDivElement | null>(null);

  const virtualizer = useVirtualizer({
    count: conversations.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 72,
    overscan: 8,
  });

  const items = virtualizer.getVirtualItems();

  return (
    <div ref={parentRef} className="min-h-0 flex-1 overflow-y-auto px-1 py-2">
      <div
        style={{
          height: `${virtualizer.getTotalSize()}px`,
          width: "100%",
          position: "relative",
        }}
      >
        {items.map((virtualRow) => {
          const conversation = conversations[virtualRow.index];
          if (!conversation) return null;
          return (
            <div
              key={String(conversation.id)}
              data-index={virtualRow.index}
              ref={virtualizer.measureElement}
              className="absolute left-0 top-0 w-full"
              style={{ transform: `translateY(${virtualRow.start}px)` }}
            >
              <ConversationListItem
                conversation={conversation}
                isActive={
                  String(selectedConversationId) === String(conversation.id)
                }
                onSelect={onSelectConversation}
                deals={deals}
                dmParticipants={dmParticipants}
                members={members}
                contacts={contacts}
                currentMemberId={currentMemberId}
                unreadCount={
                  getUnreadCount?.(conversation) ??
                  (isConversationUnread(conversation) ? 1 : 0)
                }
              />
            </div>
          );
        })}
      </div>

      {hasMore ? (
        <div className="px-3 py-2">
          <button
            type="button"
            className={cn(
              "w-full rounded-lg border border-dashed py-2 text-sm text-muted-foreground hover:bg-muted/30",
              loadingMore && "opacity-60",
            )}
            disabled={loadingMore}
            onClick={onLoadMore}
          >
            {loadingMore ? "Loading…" : "Load more conversations"}
          </button>
        </div>
      ) : null}
    </div>
  );
};
