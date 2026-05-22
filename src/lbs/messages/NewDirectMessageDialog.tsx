import { useMemo, useState } from "react";
import {
  useGetIdentity,
  useGetList,
  useGetMany,
  type Identifier,
} from "ra-core";
import { MessageSquarePlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { Conversation, OrganizationMember } from "@/lbs/types";
import { useOpenDirectMessage } from "@/lbs/messages/useDirectMessage";

export const NewDirectMessageDialog = ({
  open,
  onOpenChange,
  onConversationCreated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConversationCreated: (conversation: Conversation) => void;
}) => {
  const { identity } = useGetIdentity();
  const [selectedMemberId, setSelectedMemberId] = useState<Identifier | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const { openDirectMessage } = useOpenDirectMessage();

  const { data: members = [] } = useGetList<OrganizationMember>(
    "organization_members",
    {
      pagination: { page: 1, perPage: 100 },
      sort: { field: "last_name", order: "ASC" },
    },
    { enabled: open, staleTime: 60_000 },
  );

  const teammates = useMemo(
    () => members.filter((member) => String(member.id) !== String(identity?.id)),
    [identity?.id, members],
  );

  const handleCreate = async () => {
    const member = teammates.find(
      (entry) => String(entry.id) === String(selectedMemberId),
    );
    if (!member) return;

    setIsCreating(true);
    try {
      const conversation = await openDirectMessage(member);
      onConversationCreated(conversation);
      onOpenChange(false);
      setSelectedMemberId(null);
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>New message</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">
          Choose a teammate to start a direct conversation.
        </p>
        <div className="max-h-72 space-y-1 overflow-y-auto rounded-xl border bg-muted/20 p-1">
          {teammates.map((member) => {
            const label =
              `${member.first_name ?? ""} ${member.last_name ?? ""}`.trim() ||
              member.email ||
              `Member #${member.id}`;
            const isSelected = String(member.id) === String(selectedMemberId);

            return (
              <button
                key={String(member.id)}
                type="button"
                className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm transition-colors hover:bg-background ${
                  isSelected ? "bg-background shadow-sm" : ""
                }`}
                onClick={() => setSelectedMemberId(member.id)}
              >
                <span className="flex size-9 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold">
                  {label
                    .split(/\s+/)
                    .slice(0, 2)
                    .map((part) => part[0])
                    .join("")
                    .toUpperCase()}
                </span>
                <span className="min-w-0 flex-1 truncate font-medium">{label}</span>
              </button>
            );
          })}
        </div>
        <DialogFooter>
          <Button
            type="button"
            onClick={() => void handleCreate()}
            disabled={!selectedMemberId || isCreating}
          >
            Start chat
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export const NewDirectMessageButton = ({
  onConversationCreated,
  className,
}: {
  onConversationCreated: (conversation: Conversation) => void;
  className?: string;
}) => {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button
        type="button"
        size="sm"
        className={className}
        onClick={() => setOpen(true)}
      >
        <MessageSquarePlus className="size-4" />
        New message
      </Button>
      <NewDirectMessageDialog
        open={open}
        onOpenChange={setOpen}
        onConversationCreated={onConversationCreated}
      />
    </>
  );
};
