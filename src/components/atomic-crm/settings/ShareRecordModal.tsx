import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Share2 } from "lucide-react";
import { useGetIdentity, useGetList, useNotify } from "ra-core";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { hasMemberCapability } from "@/components/atomic-crm/providers/commons/memberModuleAccess";
import type { OrganizationMember } from "@/components/atomic-crm/types";
import { supabase } from "@/components/atomic-crm/providers/supabase/supabase";
import { useCurrentOrgId } from "@/lib/permissions/useMaskedAmount";

export type ShareableResourceType =
  | "deals"
  | "proposals"
  | "contracts"
  | "tasks"
  | "conversations"
  | "tickets";

type ShareRecordModalProps = {
  resourceType: ShareableResourceType;
  resourceId: number | string;
  orgId?: number | string | null;
  label?: string;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  hideTrigger?: boolean;
};

type RecordShareRow = {
  id: number;
  member_id: number;
};

export const ShareRecordModal = ({
  resourceType,
  resourceId,
  orgId,
  label = "Share with…",
  open: openProp,
  onOpenChange,
  hideTrigger = false,
}: ShareRecordModalProps) => {
  const [internalOpen, setInternalOpen] = useState(false);
  const open = openProp ?? internalOpen;
  const setOpen = onOpenChange ?? setInternalOpen;
  const notify = useNotify();
  const queryClient = useQueryClient();
  const { data: identity } = useGetIdentity();
  const { data: resolvedOrgId } = useCurrentOrgId(orgId == null);
  const effectiveOrgId = orgId ?? resolvedOrgId;

  const canManageSharing = hasMemberCapability(
    identity as Parameters<typeof hasMemberCapability>[0],
    "records.share",
  );

  const { data: members = [] } = useGetList<OrganizationMember>(
    "organization_members",
    {
      pagination: { page: 1, perPage: 200 },
      sort: { field: "first_name", order: "ASC" },
    },
    { enabled: open && canManageSharing },
  );

  const sharesQueryKey = ["record_shares", resourceType, resourceId, effectiveOrgId];

  const { data: existingShares = [] } = useQuery({
    queryKey: sharesQueryKey,
    enabled: open && canManageSharing && effectiveOrgId != null,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("record_shares")
        .select("id, member_id")
        .eq("org_id", effectiveOrgId!)
        .eq("resource_type", resourceType)
        .eq("resource_id", resourceId);
      if (error) throw error;
      return (data ?? []) as RecordShareRow[];
    },
  });

  const sharedMemberIds = useMemo(
    () => new Set(existingShares.map((row) => String(row.member_id))),
    [existingShares],
  );

  const { mutate: toggleShare, isPending } = useMutation({
    mutationFn: async ({
      memberId,
      enabled,
    }: {
      memberId: number | string;
      enabled: boolean;
    }) => {
      const currentMemberId =
        identity && typeof identity === "object" ? identity.id : null;
      if (currentMemberId == null) {
        throw new Error("Could not resolve your workspace member id");
      }
      if (effectiveOrgId == null) {
        throw new Error("Could not resolve organization");
      }

      if (enabled) {
        const { error } = await supabase.from("record_shares").insert({
          org_id: effectiveOrgId,
          resource_type: resourceType,
          resource_id: resourceId,
          member_id: memberId,
          shared_by_member_id: currentMemberId,
        });
        if (error) throw error;
        return;
      }

      const { error } = await supabase
        .from("record_shares")
        .delete()
        .eq("org_id", effectiveOrgId)
        .eq("resource_type", resourceType)
        .eq("resource_id", resourceId)
        .eq("member_id", memberId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: sharesQueryKey });
    },
    onError: (error: Error) => {
      notify(error.message || "Could not update sharing", { type: "error" });
    },
  });

  if (!canManageSharing) return null;

  return (
    <>
      {!hideTrigger ? (
        <Button type="button" variant="outline" size="sm" onClick={() => setOpen(true)}>
          <Share2 className="mr-2 h-4 w-4" />
          {label}
        </Button>
      ) : null}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Share record</DialogTitle>
            <DialogDescription>
              Grant specific teammates access to this {resourceType.slice(0, -1)}{" "}
              even when they are not assigned.
            </DialogDescription>
          </DialogHeader>
          <div className="max-h-80 space-y-2 overflow-y-auto">
            {members
              .filter((member) => !member.disabled)
              .map((member) => {
                const checked = sharedMemberIds.has(String(member.id));
                return (
                  <div
                    key={member.id}
                    className="flex items-center justify-between rounded-md border px-3 py-2"
                  >
                    <div>
                      <p className="text-sm font-medium">
                        {member.first_name} {member.last_name}
                      </p>
                      <p className="text-xs text-muted-foreground">{member.email}</p>
                    </div>
                    <Switch
                      checked={checked}
                      disabled={isPending}
                      onCheckedChange={(next) =>
                        toggleShare({ memberId: member.id, enabled: next })
                      }
                    />
                  </div>
                );
              })}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};
