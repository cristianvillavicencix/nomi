import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, Users } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useGetIdentity, useGetList, useNotify } from "ra-core";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { OrganizationMember } from "@/components/atomic-crm/types";
import { formatOrganizationMemberName } from "@/modules/billing/billingUtils";
import type { MailAccount } from "@/modules/mail/types";
import {
  getMailAccountShares,
  setMailAccountShares,
} from "@/modules/mail/mailAccountShareApi";

type DraftShare = {
  member_id: number;
  can_view: boolean;
  can_send: boolean;
};

const memberLabel = (member: OrganizationMember) =>
  formatOrganizationMemberName(member) ??
  member.email?.trim() ??
  `Member #${member.id}`;

export const MailAccountShareDialog = ({
  account,
  open,
  onOpenChange,
}: {
  account: MailAccount | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) => {
  const notify = useNotify();
  const queryClient = useQueryClient();
  const { identity } = useGetIdentity();
  const [draft, setDraft] = useState<DraftShare[]>([]);

  const { data: members = [], isPending: membersPending } =
    useGetList<OrganizationMember>("organization_members", {
      pagination: { page: 1, perPage: 200 },
      sort: { field: "first_name", order: "ASC" },
    });

  const eligibleMembers = useMemo(
    () =>
      members.filter(
        (member) =>
          !member.disabled && String(member.id) !== String(identity?.id),
      ),
    [identity?.id, members],
  );

  const sharesQuery = useQuery({
    queryKey: ["mail_account_shares", account?.id],
    queryFn: () => getMailAccountShares(account!.id),
    enabled: open && account != null,
  });

  useEffect(() => {
    if (!open || !account) return;
    const existing = new Map(
      (sharesQuery.data ?? []).map((share) => [share.member_id, share]),
    );
    setDraft(
      eligibleMembers.map((member) => {
        const share = existing.get(Number(member.id));
        return {
          member_id: Number(member.id),
          can_view: share?.can_view ?? false,
          can_send: share?.can_send ?? false,
        };
      }),
    );
  }, [account, eligibleMembers, open, sharesQuery.data]);

  const saveMutation = useMutation({
    mutationFn: (shares: DraftShare[]) =>
      setMailAccountShares(
        account!.id,
        shares.filter((entry) => entry.can_view || entry.can_send),
      ),
    onSuccess: () => {
      notify("Mailbox sharing updated", { type: "success" });
      void queryClient.invalidateQueries({
        queryKey: ["mail_account_shares", account?.id],
      });
      void queryClient.invalidateQueries({ queryKey: ["mail_accounts_safe"] });
      onOpenChange(false);
    },
    onError: (error) => {
      notify(error instanceof Error ? error.message : "Failed to save sharing", {
        type: "error",
      });
    },
  });

  const updateMember = (
    memberId: number,
    patch: Partial<Pick<DraftShare, "can_view" | "can_send">>,
  ) => {
    setDraft((current) =>
      current.map((entry) =>
        entry.member_id === memberId ? { ...entry, ...patch } : entry,
      ),
    );
  };

  const sharedCount = draft.filter(
    (entry) => entry.can_view || entry.can_send,
  ).length;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] max-w-lg overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Share mailbox</DialogTitle>
          <p className="text-sm text-muted-foreground">
            Choose who can view or send from{" "}
            <span className="font-medium text-foreground">{account?.email}</span>
            . Only admins can change sharing.
          </p>
        </DialogHeader>

        {membersPending || sharesQuery.isPending ? (
          <div className="flex items-center gap-2 py-8 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" />
            Loading team members…
          </div>
        ) : (
          <div className="space-y-3">
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>{sharedCount} member(s) with access</span>
              <span className="inline-flex items-center gap-1">
                <Users className="size-3.5" />
                Organization only
              </span>
            </div>
            <ul className="divide-y rounded-md border">
              {eligibleMembers.map((member) => {
                const entry = draft.find(
                  (row) => row.member_id === Number(member.id),
                ) ?? {
                  member_id: Number(member.id),
                  can_view: false,
                  can_send: false,
                };
                const enabled = entry.can_view || entry.can_send;

                return (
                  <li
                    key={member.id}
                    className="flex flex-wrap items-center gap-3 px-3 py-2.5"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">
                        {memberLabel(member)}
                      </p>
                      <p className="truncate text-xs text-muted-foreground">
                        {member.email}
                      </p>
                    </div>
                    <label className="flex items-center gap-2 text-xs">
                      <Checkbox
                        checked={entry.can_view}
                        onCheckedChange={(checked) =>
                          updateMember(Number(member.id), {
                            can_view: checked === true,
                            can_send:
                              checked === true ? entry.can_send : false,
                          })
                        }
                      />
                      View
                    </label>
                    <label className="flex items-center gap-2 text-xs">
                      <Checkbox
                        checked={entry.can_send}
                        disabled={!entry.can_view}
                        onCheckedChange={(checked) =>
                          updateMember(Number(member.id), {
                            can_send: checked === true,
                          })
                        }
                      />
                      Send
                    </label>
                    {!enabled ? (
                      <span className="text-[10px] text-muted-foreground">
                        No access
                      </span>
                    ) : null}
                  </li>
                );
              })}
            </ul>
            {eligibleMembers.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No other team members to share with.
              </p>
            ) : null}
          </div>
        )}

        <DialogFooter>
          <Button type="button" variant="secondary" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            type="button"
            disabled={!account || saveMutation.isPending}
            onClick={() => saveMutation.mutate(draft)}
          >
            {saveMutation.isPending ? (
              <Loader2 className="mr-2 size-4 animate-spin" />
            ) : null}
            Save sharing
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
