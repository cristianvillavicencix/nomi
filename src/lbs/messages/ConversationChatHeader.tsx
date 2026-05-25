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
import {
  getConversationDisplay,
  getInitials,
} from "@/lbs/messages/conversationDisplay";
import { ConversationActionsMenu } from "@/lbs/messages/ConversationActionsMenu";
import { ChangeStatusDropdown } from "@/lbs/messages/status/ChangeStatusDropdown";
import { SendFormButton } from "@/lbs/forms-v2/share/SendFormButton";
import { useOrgPresence } from "@/lbs/messages/useOrgPresence";
import { getOtherDmMemberId } from "@/lbs/messages/useDirectMessage";
import { cn } from "@/lib/utils";

const AssigneeChip = ({
  assignee,
  online,
}: {
  assignee: OrganizationMember;
  online: boolean;
}) => {
  const name =
    [assignee.first_name, assignee.last_name].filter(Boolean).join(" ") ||
    assignee.email ||
    "Assignee";
  const avatarSrc =
    typeof assignee.avatar === "object" &&
    assignee.avatar != null &&
    "src" in assignee.avatar
      ? (assignee.avatar as { src?: string }).src
      : undefined;

  return (
    <span className="inline-flex max-w-full items-center gap-1.5 rounded-full bg-muted/40 px-2 py-0.5 text-xs text-muted-foreground">
      <span className="shrink-0 opacity-70">Assigned to</span>
      <span className="relative inline-flex shrink-0">
        <Avatar className="size-4">
          <AvatarImage src={avatarSrc} alt={name} />
          <AvatarFallback className="text-[9px] font-medium">
            {getInitials(name)}
          </AvatarFallback>
        </Avatar>
        <span
          aria-hidden
          className={cn(
            "absolute -bottom-0.5 -right-0.5 size-1.5 rounded-full ring-1 ring-background",
            online ? "bg-emerald-500" : "bg-muted-foreground/30",
          )}
        />
      </span>
      <span className="truncate font-medium text-foreground/80">{name}</span>
    </span>
  );
};

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

  const { isOnline } = useOrgPresence();
  const isDm = conversation.type === "team_dm";
  const dmParticipantIds = isDm
    ? dmParticipants
        .filter(
          (entry) => String(entry.conversation_id) === String(conversation.id),
        )
        .map((entry) => entry.member_id)
    : [];
  const otherMemberId = isDm
    ? getOtherDmMemberId(conversation, dmParticipantIds, currentMemberId)
    : null;
  const otherMemberOnline = otherMemberId != null && isOnline(otherMemberId);
  const assigneeOnline = assignee != null && isOnline(assignee.id);

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

        <span className="relative inline-flex shrink-0">
          <Avatar className="size-11">
            {display.memberAvatarSrc ? (
              <AvatarImage src={display.memberAvatarSrc} alt={display.title} />
            ) : null}
            <AvatarFallback className="text-sm font-medium">
              {display.initials}
            </AvatarFallback>
          </Avatar>
          {isDm && otherMemberId != null ? (
            <>
              <span
                aria-hidden
                className={cn(
                  "absolute -bottom-0.5 -right-0.5 size-2.5 rounded-full ring-2 ring-background",
                  otherMemberOnline
                    ? "bg-emerald-500"
                    : "bg-muted-foreground/30",
                )}
              />
              <span className="sr-only">
                {otherMemberOnline ? "Online" : "Offline"}
              </span>
            </>
          ) : null}
        </span>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <h2 className="truncate text-base font-semibold">
              {display.title}
            </h2>
            <ChangeStatusDropdown conversation={conversation} />
          </div>
          <div className="mt-0.5 flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
            <span className="truncate">
              {isDm && otherMemberId != null
                ? otherMemberOnline
                  ? "Online"
                  : "Offline"
                : display.typeLabel}
            </span>
            {assignee ? (
              <>
                <span aria-hidden className="opacity-50">
                  ·
                </span>
                <AssigneeChip assignee={assignee} online={assigneeOnline} />
              </>
            ) : null}
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-1">
          {conversation.type === "client" && conversation.contact_id ? (
            <SendFormButton
              variant="icon"
              context={{
                type: "conversation",
                conversation_id: Number(conversation.id),
                contact_id: Number(conversation.contact_id),
                deal_id: conversation.deal_id
                  ? Number(conversation.deal_id)
                  : undefined,
              }}
            />
          ) : null}
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
    </div>
  );
};
