import { useEffect, useMemo, useState } from "react";
import { useNotify, useUpdate } from "ra-core";
import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
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
import { computeValidUntil } from "@/lbs/proposals/proposalCommercialUtils";
import { DEFAULT_VALIDITY_DAYS } from "@/lbs/proposals/proposalCommercialConstants";
import type { Proposal } from "@/lbs/types";

const formatDisplayDate = (value?: string | null) => {
  if (!value) return "—";
  const date = new Date(`${value}T12:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
};

export const daysUntilValidUntil = (validUntil?: string | null) => {
  if (!validUntil) return null;
  const end = new Date(`${validUntil}T12:00:00`);
  const today = new Date();
  today.setHours(12, 0, 0, 0);
  return Math.round((end.getTime() - today.getTime()) / 86_400_000);
};

export const ProposalSendExpiryDialog = ({
  proposal,
  open,
  onOpenChange,
  onContinue,
  onProposalUpdated,
}: {
  proposal: Proposal;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onContinue: () => void;
  onProposalUpdated?: () => void;
}) => {
  const notify = useNotify();
  const [updateProposal, { isPending }] = useUpdate();
  const [validityDays, setValidityDays] = useState(
    proposal.validity_days ?? DEFAULT_VALIDITY_DAYS,
  );

  useEffect(() => {
    if (open) {
      setValidityDays(proposal.validity_days ?? DEFAULT_VALIDITY_DAYS);
    }
  }, [open, proposal.validity_days]);

  const daysLeft = useMemo(
    () => daysUntilValidUntil(proposal.valid_until),
    [proposal.valid_until],
  );

  const isExpired = daysLeft != null && daysLeft < 0;
  const isSoon = daysLeft != null && daysLeft >= 0 && daysLeft <= 3;

  const handleUpdateAndContinue = async () => {
    const days = Math.max(1, Math.min(365, validityDays));
    const validUntil = computeValidUntil(days);
    try {
      await updateProposal(
        "proposals",
        {
          id: proposal.id,
          data: {
            validity_days: days,
            valid_until: validUntil,
          },
          previousData: proposal,
        },
        { returnPromise: true },
      );
      notify("Expiration updated", { type: "success" });
      onProposalUpdated?.();
      onOpenChange(false);
      onContinue();
    } catch {
      notify("Failed to update expiration", { type: "error" });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Review expiration before sending</DialogTitle>
          <DialogDescription>
            Confirm how long this proposal stays valid for the client.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div
            className={
              isExpired || isSoon
                ? "rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 text-sm"
                : "rounded-lg border bg-muted/40 p-3 text-sm"
            }
          >
            {isExpired || isSoon ? (
              <div className="mb-2 flex items-center gap-2 font-medium text-amber-800 dark:text-amber-200">
                <AlertTriangle className="size-4 shrink-0" />
                {isExpired ? "This proposal has expired" : "Expires very soon"}
              </div>
            ) : null}
            <p>
              <span className="text-muted-foreground">Valid until: </span>
              <span className="font-medium">
                {formatDisplayDate(proposal.valid_until)}
              </span>
            </p>
            <p className="mt-1">
              <span className="text-muted-foreground">Configured: </span>
              <span className="font-medium">
                {proposal.validity_days ?? DEFAULT_VALIDITY_DAYS} days
              </span>
              {daysLeft != null ? (
                <>
                  {" "}
                  <span className="text-muted-foreground">·</span>{" "}
                  <span className="font-medium">
                    {daysLeft < 0
                      ? `${Math.abs(daysLeft)} days ago`
                      : daysLeft === 0
                        ? "expires today"
                        : `${daysLeft} day${daysLeft === 1 ? "" : "s"} left`}
                  </span>
                </>
              ) : null}
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="proposal-send-validity-days">
              Change validity (days)
            </Label>
            <Input
              id="proposal-send-validity-days"
              type="number"
              min={1}
              max={365}
              value={validityDays}
              onChange={(event) =>
                setValidityDays(Number(event.target.value) || DEFAULT_VALIDITY_DAYS)
              }
            />
            <p className="text-xs text-muted-foreground">
              New expiration: {formatDisplayDate(computeValidUntil(validityDays))}
            </p>
          </div>
        </div>

        <DialogFooter className="flex-col gap-2 sm:flex-row sm:justify-end">
          <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            type="button"
            variant="outline"
            disabled={isPending}
            onClick={() => {
              onOpenChange(false);
              onContinue();
            }}
          >
            Continue as is
          </Button>
          <Button
            type="button"
            disabled={isPending}
            onClick={() => void handleUpdateAndContinue()}
          >
            Update & send
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
