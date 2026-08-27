import { CheckCheck } from "lucide-react";
import type { Identifier } from "ra-core";
import type {
  Contact,
  Conversation,
  ConversationParticipant,
  LbsDeal,
  OrganizationMember,
} from "@/modules/types";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  getConversationDisplay,
  formatConversationListTime,
} from "@/modules/messages/conversationDisplay";
import { formatUnreadBadgeCount } from "@/modules/messages/messagesUnreadUtils";
import { useCanViewAmounts } from "@/lib/permissions/useMaskedAmount";
import { useIsMobile } from "@/hooks/use-mobile";
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
  const canViewAmounts = useCanViewAmounts();
  const isMobile = useIsMobile();
  const display = getConversationDisplay({
    conversation,
    deals,
    dmParticipants,
    members,
    contacts,
    currentMemberId,
    canViewAmounts,
  });
  const timeLabel = formatConversationListTime(display.activityAt);
  const hasUnread = unreadCount > 0;

  return (
    <button
      type="button"
      className={cn(
        "flex w-full items-center gap-3 rounded-2xl px-2.5 py-2 text-left transition-colors",
        isMobile
          ? isActive
            ? "bg-white/45 dark:bg-white/10"
            : hasUnread
              ? "bg-white/20 dark:bg-white/[0.07]"
              : "hover:bg-white/25 dark:hover:bg-white/5"
          : isActive
            ? "bg-muted/50"
            : hasUnread
              ? "bg-muted/25"
              : "hover:bg-muted/35",
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
        <div
          className={cn(
            "mt-0.5 flex min-w-0 items-center gap-1 text-sm text-muted-foreground",
            hasUnread && "text-foreground/80",
          )}
        >
          {display.isOutboundPreview ? (
            <CheckCheck
              className="size-3.5 shrink-0 text-muted-foreground"
              aria-label="Sent"
            />
          ) : null}
          <p className="min-w-0 truncate">{display.preview}</p>
        </div>
      </div>
    </button>
  );
};
