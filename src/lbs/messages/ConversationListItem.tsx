import type { Identifier } from "ra-core";
import type {
  Contact,
  Conversation,
  ConversationParticipant,
  LbsDeal,
  OrganizationMember,
} from "@/lbs/types";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { getConversationDisplay, formatConversationListTime } from "@/lbs/messages/conversationDisplay";
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
}: {
  conversation: Conversation;
  isActive: boolean;
  onSelect: (conversation: Conversation) => void;
  deals: LbsDeal[];
  dmParticipants: ConversationParticipant[];
  members: OrganizationMember[];
  contacts?: Contact[];
  currentMemberId?: Identifier;
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

  return (
    <button
      type="button"
      className={cn(
        "flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-colors",
        isActive ? "bg-primary/10" : "hover:bg-muted/60",
      )}
      onClick={() => onSelect(conversation)}
    >
      <Avatar className="size-11">
        {display.memberAvatarSrc ? (
          <AvatarImage src={display.memberAvatarSrc} alt={display.title} />
        ) : null}
        <AvatarFallback className="text-sm font-medium">{display.initials}</AvatarFallback>
      </Avatar>

      <div className="min-w-0 flex-1">
        <div className="flex items-baseline justify-between gap-2">
          <span className="truncate font-medium">{display.title}</span>
          {timeLabel ? (
            <span className="shrink-0 text-[11px] text-muted-foreground">{timeLabel}</span>
          ) : null}
        </div>
        <div className="mt-0.5 flex items-center gap-2">
          <span className="truncate text-sm text-muted-foreground">{display.preview}</span>
          {conversation.type === "project" ? (
            <span className="shrink-0 rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
              Team
            </span>
          ) : null}
          {conversation.type === "client" ? (
            <span className="shrink-0 rounded-full bg-emerald-500/10 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-emerald-700 dark:text-emerald-300">
              SMS
            </span>
          ) : null}
        </div>
      </div>
    </button>
  );
};
