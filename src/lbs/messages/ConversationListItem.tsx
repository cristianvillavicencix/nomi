import type { Identifier } from "ra-core";
import type {
  Contact,
  Conversation,
  ConversationParticipant,
  LbsDeal,
  OrganizationMember,
} from "@/lbs/types";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  getConversationDisplay,
  formatConversationListTime,
} from "@/lbs/messages/conversationDisplay";
import { formatUnreadBadgeCount } from "@/lbs/messages/messagesUnreadUtils";
import { cn } from "@/lib/utils";

export const ConversationListItem = ({
  conversation,
  isActive,
  onSelect,
  deals,
  dmParticipants,
  members,
  contacts = [],
  currentMemberId,
  unreadCount = 0,
}: {
  conversation: Conversation;
  isActive: boolean;
  onSelect: (conversation: Conversation) => void;
  deals: LbsDeal[];
  dmParticipants: ConversationParticipant[];
  members: OrganizationMember[];
  contacts?: Contact[];
  currentMemberId?: Identifier;
  unreadCount?: number;
}) => {
  const display = getConversationDisplay({
    conversation,
    deals,
    dmParticipants,
    members,
    contacts,
    currentMemberId,
  });
  const timeLabel = formatConversationListTime(display.activityAt);
  const hasUnread = unreadCount > 0;

  return (
    <button
      type="button"
      className={cn(
        "flex w-full items-center gap-3 rounded-lg px-2.5 py-2 text-left transition-colors",
        isActive ? "bg-muted/50" : "hover:bg-muted/35",
        hasUnread && !isActive && "bg-muted/25",
      )}
      onClick={() => onSelect(conversation)}
    >
      <Avatar className="size-11">
        {display.memberAvatarSrc ? (
          <AvatarImage src={display.memberAvatarSrc} alt={display.title} />
        ) : null}
        <AvatarFallback className="text-sm font-medium">
          {display.initials}
        </AvatarFallback>
      </Avatar>

      <div className="min-w-0 flex-1">
        <div className="flex items-baseline justify-between gap-2">
          <span className={cn("truncate", hasUnread && "font-semibold")}>
            {display.title}
          </span>
          <div className="flex shrink-0 items-center gap-1.5">
            {hasUnread ? (
              <span
                className="min-w-[20px] rounded-full bg-muted px-1.5 py-0.5 text-center text-xs font-medium text-muted-foreground"
                aria-label={`${unreadCount} unread messages`}
              >
                {formatUnreadBadgeCount(unreadCount)}
              </span>
            ) : null}
            {timeLabel ? (
              <span className="text-[11px] text-muted-foreground">
                {timeLabel}
              </span>
            ) : null}
          </div>
        </div>
        <p
          className={cn(
            "mt-0.5 truncate text-sm text-muted-foreground",
            hasUnread && "text-foreground/80",
          )}
        >
          {display.preview}
        </p>
      </div>
    </button>
  );
};
