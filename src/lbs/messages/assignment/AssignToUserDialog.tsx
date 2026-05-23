import { useMemo, useState } from "react";
import { UserRound } from "lucide-react";
import { useNotify, useUpdate, type Identifier } from "ra-core";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { Conversation, OrganizationMember } from "@/lbs/types";
import { useMemberCapability } from "@/components/atomic-crm/providers/commons/useMemberCapability";

export const AssignToUserDialog = ({
  conversation,
  members,
  onAssigned,
  open: openProp,
  onOpenChange,
  hideTrigger = false,
}: {
  conversation: Conversation;
  members: OrganizationMember[];
  onAssigned?: () => void;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  hideTrigger?: boolean;
}) => {
  const canAssign = useMemberCapability("messaging.assign");
  const notify = useNotify();
  const [update] = useUpdate();
  const [internalOpen, setInternalOpen] = useState(false);
  const open = openProp ?? internalOpen;
  const setOpen = onOpenChange ?? setInternalOpen;
  const [assigneeId, setAssigneeId] = useState<string>(
    conversation.assignee_member_id != null
      ? String(conversation.assignee_member_id)
      : "none",
  );

  const activeMembers = useMemo(
    () =>
      members
        .filter((member) => member.disabled !== true)
        .sort((a, b) =>
          `${a.first_name ?? ""} ${a.last_name ?? ""}`.localeCompare(
            `${b.first_name ?? ""} ${b.last_name ?? ""}`,
          ),
        ),
    [members],
  );

  if (!canAssign) return null;

  const handleSave = () => {
    const nextAssignee =
      assigneeId === "none"
        ? null
        : (Number(assigneeId) as unknown as Identifier);
    update(
      "conversations",
      {
        id: conversation.id,
        data: { assignee_member_id: nextAssignee },
        previousData: conversation,
      },
      {
        onSuccess: () => {
          notify("Conversation assigned", { type: "success" });
          setOpen(false);
          onAssigned?.();
        },
        onError: () => {
          notify("Failed to assign conversation", { type: "error" });
        },
      },
    );
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {!hideTrigger ? (
        <DialogTrigger asChild>
          <Button type="button" variant="outline" size="sm">
            <UserRound className="size-4" />
            Assign
          </Button>
        </DialogTrigger>
      ) : null}
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Assign conversation</DialogTitle>
        </DialogHeader>
        <Select value={assigneeId} onValueChange={setAssigneeId}>
          <SelectTrigger>
            <SelectValue placeholder="Select team member" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="none">Unassigned</SelectItem>
            {activeMembers.map((member) => (
              <SelectItem key={String(member.id)} value={String(member.id)}>
                {[member.first_name, member.last_name]
                  .filter(Boolean)
                  .join(" ") ||
                  member.email ||
                  `Member #${member.id}`}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => setOpen(false)}
          >
            Cancel
          </Button>
          <Button type="button" onClick={handleSave}>
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
