import { useEffect, useMemo, useState } from "react";
import { useGetList } from "ra-core";
import { AlertTriangle, Loader2, Rocket } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { getLaunchChecklistCategoryLabel } from "@/modules/deals/projects/launch/launchChecklistUtils";
import type { Identifier } from "ra-core";

const MIN_REASON_LENGTH = 10;

export type ManualOverridePayload = {
  reason: string;
  force_approved_items: Array<{
    id: number;
    label: string;
    category?: string | null;
  }>;
};

type ChecklistItem = {
  id: Identifier;
  label: string;
  category?: string | null;
  description?: string | null;
  is_required: boolean;
  is_completed: boolean;
};

type Props = {
  open: boolean;
  onClose: () => void;
  dealId: Identifier;
  defaultSiteUrl?: string | null;
  isSubmitting?: boolean;
  onConfirm: (payload: ManualOverridePayload & { site_url?: string }) => void;
};

export const ManualDeliveryOverrideDialog = ({
  open,
  onClose,
  dealId,
  defaultSiteUrl,
  isSubmitting = false,
  onConfirm,
}: Props) => {
  const { data: pendingItems = [], isPending } = useGetList<ChecklistItem>(
    "deal_launch_checklist_items",
    {
      filter: {
        "deal_id@eq": dealId,
        "is_required@eq": true,
        "is_completed@eq": false,
      },
      pagination: { page: 1, perPage: 100 },
      sort: { field: "order_index", order: "ASC" },
    },
    { enabled: open && !!dealId },
  );

  const [approvedIds, setApprovedIds] = useState<Set<string>>(new Set());
  const [reason, setReason] = useState("");
  const [siteUrl, setSiteUrl] = useState("");

  useEffect(() => {
    if (!open) return;
    setApprovedIds(new Set());
    setReason("");
    setSiteUrl(defaultSiteUrl?.trim() ?? "");
  }, [open, defaultSiteUrl]);

  const toggleItem = (id: Identifier) => {
    setApprovedIds((prev) => {
      const next = new Set(prev);
      const key = String(id);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const allApproved = useMemo(
    () =>
      pendingItems.length > 0 &&
      pendingItems.every((item) => approvedIds.has(String(item.id))),
    [pendingItems, approvedIds],
  );

  const reasonValid = reason.trim().length >= MIN_REASON_LENGTH;
  const canSubmit = allApproved && reasonValid;

  const handleConfirm = () => {
    if (!canSubmit || isSubmitting) return;
    onConfirm({
      reason: reason.trim(),
      site_url: siteUrl.trim() || undefined,
      force_approved_items: pendingItems.map((item) => ({
        id: Number(item.id),
        label: item.label,
        category: item.category ?? null,
      })),
    });
  };

  return (
    <Dialog open={open} onOpenChange={(next) => (next ? null : onClose())}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="text-warning size-5" />
            Manual delivery override
          </DialogTitle>
          <DialogDescription>
            The launch checklist has required items that are still incomplete.
            Approve each one manually and explain why you are forcing the
            delivery. This stays on the audit log.
          </DialogDescription>
        </DialogHeader>

        <div className="flex max-h-[55vh] flex-col gap-4 overflow-y-auto pr-1">
          {isPending ? (
            <p className="text-muted-foreground text-sm">Loading checklist…</p>
          ) : pendingItems.length === 0 ? (
            <p className="text-muted-foreground text-sm">
              No required items pending. You can deliver normally.
            </p>
          ) : (
            <ul className="border-border divide-y divide-border rounded-md border">
              {pendingItems.map((item) => {
                const checked = approvedIds.has(String(item.id));
                return (
                  <li key={item.id} className="flex items-start gap-3 p-3">
                    <Checkbox
                      id={`override-${item.id}`}
                      checked={checked}
                      onCheckedChange={() => toggleItem(item.id)}
                      className="mt-0.5"
                    />
                    <Label
                      htmlFor={`override-${item.id}`}
                      className="flex flex-1 cursor-pointer flex-col gap-1"
                    >
                      <span className="text-sm font-medium leading-tight">
                        {item.label}
                      </span>
                      {item.category ? (
                        <span className="text-muted-foreground text-[11px] uppercase tracking-wide">
                          {getLaunchChecklistCategoryLabel(item.category)}
                        </span>
                      ) : null}
                      {item.description ? (
                        <span className="text-muted-foreground text-xs">
                          {item.description}
                        </span>
                      ) : null}
                    </Label>
                  </li>
                );
              })}
            </ul>
          )}

          <div className="flex flex-col gap-1">
            <Label htmlFor="override-reason">
              Reason for override
              <span className="text-destructive ml-1">*</span>
            </Label>
            <Textarea
              id="override-reason"
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              placeholder="Why are you forcing this delivery without completing the required items?"
              rows={3}
            />
            <span className="text-muted-foreground text-xs">
              Minimum {MIN_REASON_LENGTH} characters. Currently{" "}
              {reason.trim().length}.
            </span>
          </div>

          <div className="flex flex-col gap-1">
            <Label htmlFor="override-site-url">Site URL (optional)</Label>
            <Input
              id="override-site-url"
              value={siteUrl}
              onChange={(event) => setSiteUrl(event.target.value)}
              placeholder="https://example.com"
              type="url"
            />
            <span className="text-muted-foreground text-xs">
              Leave blank to keep the deal's current production URL.
            </span>
          </div>
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="ghost"
            onClick={onClose}
            disabled={isSubmitting}
          >
            Cancel
          </Button>
          <Button
            type="button"
            variant="destructive"
            disabled={!canSubmit || isSubmitting}
            onClick={handleConfirm}
          >
            {isSubmitting ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Rocket className="size-4" />
            )}
            Deliver with override
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
