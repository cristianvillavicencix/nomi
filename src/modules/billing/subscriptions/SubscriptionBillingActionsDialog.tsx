import { useMutation } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
import { useDataProvider, useNotify, useRefresh } from "ra-core";
import type { CrmDataProvider } from "@/components/atomic-crm/providers/types";
import { formatBillingDate } from "@/modules/billing/billingDisplayUtils";
import type { ClientSubscription } from "@/modules/types";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

export type BillingAction =
  | "pause"
  | "resume"
  | "cancel_at_period_end"
  | "cancel_now"
  | "undo_cancel";

export type PauseDurationDays = 7 | 14 | 21 | 30 | null;

type SubscriptionBillingActionsDialogProps = {
  subscription: ClientSubscription;
  /** When set, opens the confirm step for this action (picker dialog is skipped). */
  confirmAction: BillingAction | null;
  onOpenChange: (open: boolean) => void;
  canCancelDraft: boolean;
};

const PAUSE_DURATION_OPTIONS: Array<{
  days: PauseDurationDays;
  label: string;
  description: string;
}> = [
  {
    days: 7,
    label: "1 week",
    description: "Resume automatically in 7 days",
  },
  {
    days: 14,
    label: "2 weeks",
    description: "Resume automatically in 14 days",
  },
  {
    days: 21,
    label: "3 weeks",
    description: "Resume automatically in 21 days",
  },
  {
    days: 30,
    label: "1 month",
    description: "Resume automatically in 30 days",
  },
  {
    days: null,
    label: "Until I resume",
    description: "Stays paused until you click Resume",
  },
];

const successMessages: Record<BillingAction, string> = {
  pause: "Billing paused",
  resume: "Billing resumed",
  cancel_at_period_end: "Billing will stop at the end of the current period",
  cancel_now: "Billing stopped — subscription record kept for history",
  undo_cancel: "Scheduled billing stop removed",
};

const actionCopy = (
  action: BillingAction,
  subscription: ClientSubscription,
  canCancelDraft: boolean,
): { title: string; description: string; destructive?: boolean } => {
  const periodEndLabel = subscription.current_period_end
    ? formatBillingDate(subscription.current_period_end.slice(0, 10))
    : "the end of the current period";

  switch (action) {
    case "pause":
      return {
        title: "Pause billing",
        description:
          "Temporarily stop charges. This is not a cancel — use Stop if you want billing to end permanently.",
      };
    case "resume":
      return {
        title: "Resume billing",
        description: "Turn automatic charges back on for this subscription.",
      };
    case "undo_cancel":
      return {
        title: "Keep billing active",
        description:
          "Remove the scheduled stop so renewals continue after the current period.",
      };
    case "cancel_at_period_end":
      return {
        title: "Stop at period end",
        description: `Permanently stop future renewals after ${periodEndLabel}. The subscription record is kept; nothing is deleted.`,
      };
    case "cancel_now":
      return {
        title: canCancelDraft
          ? "Cancel before billing starts"
          : "Stop billing now",
        description: canCancelDraft
          ? "Mark this subscription as canceled before any charge runs. The record stays in the CRM for history."
          : "End billing immediately. The subscription record stays in the CRM — it is not deleted.",
        destructive: true,
      };
  }
};

export const SubscriptionBillingActionsDialog = ({
  subscription,
  confirmAction,
  onOpenChange,
  canCancelDraft,
}: SubscriptionBillingActionsDialogProps) => {
  const notify = useNotify();
  const refresh = useRefresh();
  const dataProvider = useDataProvider<CrmDataProvider>();
  const [pendingAction, setPendingAction] = useState<BillingAction | null>(
    confirmAction,
  );
  const [pauseDays, setPauseDays] = useState<PauseDurationDays>(7);

  useEffect(() => {
    setPendingAction(confirmAction);
    if (confirmAction === "pause") {
      setPauseDays(7);
    }
  }, [confirmAction]);

  const manageMutation = useMutation({
    mutationFn: (input: {
      action: BillingAction;
      pause_days?: number | null;
    }) =>
      dataProvider.manageClientSubscription({
        subscriptionId: subscription.id,
        action: input.action,
        pause_days: input.pause_days,
      }),
    onSuccess: (_result, input) => {
      refresh();
      setPendingAction(null);
      onOpenChange(false);
      if (input.action === "pause") {
        notify(
          input.pause_days
            ? `Billing paused — resumes automatically in ${input.pause_days} days`
            : "Billing paused — resume manually when ready",
          { type: "success" },
        );
        return;
      }
      notify(successMessages[input.action], { type: "success" });
    },
    onError: (error: Error) => {
      notify(error.message || "Could not update billing", { type: "error" });
    },
  });

  const selected = pendingAction
    ? actionCopy(pendingAction, subscription, canCancelDraft)
    : null;
  const isPause = pendingAction === "pause";

  return (
    <Dialog
      open={Boolean(pendingAction && selected)}
      onOpenChange={(nextOpen) => {
        if (!nextOpen && !manageMutation.isPending) {
          setPendingAction(null);
          onOpenChange(false);
        }
      }}
    >
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{selected?.title}</DialogTitle>
          <DialogDescription>{selected?.description}</DialogDescription>
        </DialogHeader>

        {isPause ? (
          <div className="space-y-2">
            <p className="text-xs font-medium text-muted-foreground">
              How long should billing stay paused?
            </p>
            <div className="grid gap-2">
              {PAUSE_DURATION_OPTIONS.map((option) => (
                <button
                  key={String(option.days)}
                  type="button"
                  onClick={() => setPauseDays(option.days)}
                  className={cn(
                    "rounded-md border px-3 py-2.5 text-left transition-colors",
                    pauseDays === option.days
                      ? "border-primary bg-primary/5 ring-1 ring-primary/20"
                      : "border-border hover:bg-muted/40",
                  )}
                >
                  <span className="block text-sm font-medium">
                    {option.label}
                  </span>
                  <span className="mt-0.5 block text-xs text-muted-foreground">
                    {option.description}
                  </span>
                </button>
              ))}
            </div>
            <p className="text-xs text-muted-foreground">
              Need to end billing forever? Close this and use{" "}
              <span className="font-medium text-foreground">Stop</span> instead.
            </p>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">
            This does not delete the subscription from your records. Invoice
            history and client records stay intact.
          </p>
        )}

        <DialogFooter>
          <Button
            type="button"
            variant="ghost"
            disabled={manageMutation.isPending}
            onClick={() => {
              setPendingAction(null);
              onOpenChange(false);
            }}
          >
            Cancel
          </Button>
          <Button
            type="button"
            variant={selected?.destructive ? "destructive" : "primary"}
            disabled={!pendingAction || manageMutation.isPending}
            onClick={() => {
              if (!pendingAction) return;
              manageMutation.mutate({
                action: pendingAction,
                pause_days:
                  pendingAction === "pause" ? pauseDays : undefined,
              });
            }}
          >
            {manageMutation.isPending ? (
              <>
                <Loader2 className="size-4 animate-spin" />
                Working…
              </>
            ) : isPause ? (
              "Pause billing"
            ) : (
              "Confirm"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
