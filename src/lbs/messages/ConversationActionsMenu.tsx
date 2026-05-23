import { useState } from "react";
import { Link } from "react-router";
import {
  ChevronDown,
  FolderKanban,
  PanelRight,
  Share2,
  UserRound,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { hasMemberCapability } from "@/components/atomic-crm/providers/commons/memberModuleAccess";
import { useMemberCapability } from "@/components/atomic-crm/providers/commons/useMemberCapability";
import { ShareRecordModal } from "@/components/atomic-crm/settings/ShareRecordModal";
import { AssignToUserDialog } from "@/lbs/messages/assignment/AssignToUserDialog";
import type { Conversation, OrganizationMember } from "@/lbs/types";
import { useGetIdentity } from "ra-core";

export const ConversationActionsMenu = ({
  conversation,
  members,
  dealHref,
  dealLabel = "Open project",
  contextOpen = false,
  onToggleContext,
}: {
  conversation: Conversation;
  members: OrganizationMember[];
  dealHref?: string | null;
  dealLabel?: string;
  contextOpen?: boolean;
  onToggleContext?: () => void;
}) => {
  const { data: identity } = useGetIdentity();
  const [assignOpen, setAssignOpen] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const canAssign = useMemberCapability("messaging.assign");
  const canShare = hasMemberCapability(
    identity as Parameters<typeof hasMemberCapability>[0],
    "records.share",
  );

  const hasActions =
    onToggleContext != null || dealHref != null || canAssign || canShare;

  if (!hasActions) return null;

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button type="button" variant="outline" size="sm">
            Actions
            <ChevronDown className="size-4 opacity-60" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-44">
          {onToggleContext ? (
            <DropdownMenuItem onClick={onToggleContext}>
              <PanelRight className="size-4" />
              {contextOpen ? "Hide details" : "Details"}
            </DropdownMenuItem>
          ) : null}
          {dealHref ? (
            <DropdownMenuItem asChild>
              <Link to={dealHref}>
                <FolderKanban className="size-4" />
                {dealLabel}
              </Link>
            </DropdownMenuItem>
          ) : null}
          {(onToggleContext || dealHref) && (canAssign || canShare) ? (
            <DropdownMenuSeparator />
          ) : null}
          {canAssign ? (
            <DropdownMenuItem onSelect={() => setAssignOpen(true)}>
              <UserRound className="size-4" />
              Assign
            </DropdownMenuItem>
          ) : null}
          {canShare ? (
            <DropdownMenuItem onSelect={() => setShareOpen(true)}>
              <Share2 className="size-4" />
              Share
            </DropdownMenuItem>
          ) : null}
        </DropdownMenuContent>
      </DropdownMenu>

      {canAssign ? (
        <AssignToUserDialog
          conversation={conversation}
          members={members}
          open={assignOpen}
          onOpenChange={setAssignOpen}
          hideTrigger
        />
      ) : null}

      {canShare ? (
        <ShareRecordModal
          resourceType="conversations"
          resourceId={conversation.id}
          orgId={conversation.org_id}
          open={shareOpen}
          onOpenChange={setShareOpen}
          hideTrigger
        />
      ) : null}
    </>
  );
};
