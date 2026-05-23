import { ArrowLeft } from "lucide-react";
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
import { ConversationActionsMenu } from "@/lbs/messages/ConversationActionsMenu";
import { ChangeStatusDropdown } from "@/lbs/messages/status/ChangeStatusDropdown";
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
  contextOpen = false,
  onToggleContext,
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
  contextOpen?: boolean;
  onToggleContext?: () => void;
}) => {
  const display = getConversationDisplay({
    conversation,
    deals,
    dmParticipants,
    members,
    contacts,
    currentMemberId,
  });

  const assignee = members.find(
    (member) => String(member.id) === String(conversation.assignee_member_id),
  );
  const assigneeLabel = assignee
    ? [assignee.first_name, assignee.last_name].filter(Boolean).join(" ")
    : null;

  return (
    <div
      className={cn(
        "shrink-0 border-b border-border/30 bg-background px-4 md:px-5",
        compact ? "py-2.5" : "py-3",
      )}
    >
      <div className="flex items-start gap-3">
        {showBackButton ? (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="mt-0.5 shrink-0 md:hidden"
            onClick={onBack}
            aria-label="Back to conversations"
          >
            <ArrowLeft className="size-4" />
          </Button>
        ) : null}

        <Avatar className="size-11 shrink-0">
          {display.memberAvatarSrc ? (
            <AvatarImage src={display.memberAvatarSrc} alt={display.title} />
          ) : null}
          <AvatarFallback className="text-sm font-medium">
            {display.initials}
          </AvatarFallback>
        </Avatar>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <h2 className="truncate text-base font-semibold">
              {display.title}
            </h2>
            <ChangeStatusDropdown conversation={conversation} />
          </div>
          <p className="truncate text-xs text-muted-foreground">
            {display.typeLabel}
            {assigneeLabel ? ` · Assigned to ${assigneeLabel}` : ""}
          </p>
        </div>

        <ConversationActionsMenu
          conversation={conversation}
          members={members}
          dealHref={display.dealHref}
          dealLabel={conversation.type === "client" ? "Open" : "Project"}
          contextOpen={contextOpen}
          onToggleContext={onToggleContext}
        />
      </div>
    </div>
  );
};
