import { Link } from "react-router";
import { ArrowLeft, FolderKanban } from "lucide-react";
import type { Identifier } from "ra-core";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import type {
  Contact,
  Conversation,
  ConversationParticipant,
  LbsDeal,
  OrganizationMember,
} from "@/lbs/types";
import { getConversationDisplay } from "@/lbs/messages/conversationDisplay";
import { cn } from "@/lib/utils";

export const ConversationChatHeader = ({
  conversation,
  deals,
  dmParticipants,
  members,
  contacts = [],
  currentMemberId,
  onBack,
  showBackButton = false,
  compact = false,
}: {
  conversation: Conversation;
  deals: LbsDeal[];
  dmParticipants: ConversationParticipant[];
  members: OrganizationMember[];
  contacts?: Contact[];
  currentMemberId?: Identifier;
  onBack?: () => void;
  showBackButton?: boolean;
  compact?: boolean;
}) => {
  const display = getConversationDisplay({
    conversation,
    deals,
    dmParticipants,
    members,
    contacts,
    currentMemberId,
  });

  return (
    <div className={cn("flex items-center gap-3 border-b bg-background px-4", compact ? "py-2" : "py-3")}>
      {showBackButton ? (
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="shrink-0 md:hidden"
          onClick={onBack}
          aria-label="Back to conversations"
        >
          <ArrowLeft className="size-4" />
        </Button>
      ) : null}

      <Avatar className="size-10">
        {display.memberAvatarSrc ? (
          <AvatarImage src={display.memberAvatarSrc} alt={display.title} />
        ) : null}
        <AvatarFallback className="text-sm font-medium">{display.initials}</AvatarFallback>
      </Avatar>

      <div className="min-w-0 flex-1">
        <div className="truncate font-semibold">{display.title}</div>
        <div className="truncate text-xs text-muted-foreground">{display.typeLabel}</div>
      </div>

      {display.dealHref ? (
        <Button type="button" variant="outline" size="sm" asChild className="shrink-0">
          <Link to={display.dealHref}>
            <FolderKanban className="size-4" />
            {conversation.type === "client" ? "Open" : "Project"}
          </Link>
        </Button>
      ) : null}
    </div>
  );
};
