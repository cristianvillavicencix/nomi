import { useMemo, useState } from "react";
import {
  useDataProvider,
  useGetIdentity,
  useGetList,
  useGetMany,
  type Identifier,
} from "ra-core";
import { useQuery } from "@tanstack/react-query";
import { MessageSquarePlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { Conversation, LbsDeal, OrganizationMember } from "@/lbs/types";
import { useOpenDirectMessage } from "@/lbs/messages/useDirectMessage";
import {
  buildAssignedProjectDealIdSet,
  collectCoworkerMemberIdsFromDeals,
  shouldScopeMessagingToAssignedProjects,
} from "@/lbs/messages/scopedMessaging";
import type { CrmDataProvider } from "@/components/atomic-crm/providers/types";

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
  const dataProvider = useDataProvider<CrmDataProvider>();
  const scopeToProjects = shouldScopeMessagingToAssignedProjects(identity);
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

  const { data: scopedDeals = [] } = useQuery({
    queryKey: ["dm-coworker-deals", identity?.id, scopeToProjects],
    enabled: open && scopeToProjects && identity?.id != null,
    staleTime: 60_000,
    queryFn: async () => {
      const dealIds = await dataProvider.getMyProjectDealIds({
        organizationMemberId: identity!.id,
      });
      if (dealIds.length === 0) return [] as LbsDeal[];
      const { data } = await dataProvider.getMany<LbsDeal>("deals", {
        ids: dealIds,
      });
      return data ?? [];
    },
  });

  const allowedCoworkerIds = useMemo(() => {
    if (!scopeToProjects || !identity?.id) return null;
    const dealIds = buildAssignedProjectDealIdSet(scopedDeals, identity.id);
    return collectCoworkerMemberIdsFromDeals(scopedDeals, dealIds, identity.id);
  }, [identity?.id, scopeToProjects, scopedDeals]);

  const teammates = useMemo(
    () =>
      members.filter((member) => {
        if (String(member.id) === String(identity?.id)) return false;
        if (!allowedCoworkerIds) return true;
        return allowedCoworkerIds.has(String(member.id));
      }),
    [allowedCoworkerIds, identity?.id, members],
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
          {scopeToProjects
            ? "Choose a teammate from one of your assigned projects."
            : "Choose a teammate to start a direct conversation."}
        </p>
        <div className="max-h-72 space-y-1 overflow-y-auto rounded-xl border bg-muted/20 p-1">
          {teammates.length === 0 ? (
            <p className="px-3 py-6 text-center text-sm text-muted-foreground">
              No teammates on your assigned projects yet.
            </p>
          ) : (
            teammates.map((member) => {
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
          })
          )}
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
