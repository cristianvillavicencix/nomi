import { useMutation } from "@tanstack/react-query";
import {
  CalendarClock,
  Loader2,
  OctagonX,
  Pause,
  Play,
  RotateCcw,
} from "lucide-react";
import { useState } from "react";
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

type BillingAction =
  | "pause"
  | "resume"
  | "cancel_at_period_end"
  | "cancel_now"
  | "undo_cancel";

type SubscriptionBillingActionsDialogProps = {
  subscription: ClientSubscription;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  canPause: boolean;
  canResume: boolean;
  canCancel: boolean;
  canCancelDraft: boolean;
  canUndoCancel: boolean;
};

type ActionOption = {
  action: BillingAction;
  title: string;
  description: string;
  icon: typeof Pause;
  destructive?: boolean;
};

const successMessages: Record<BillingAction, string> = {
  pause: "Billing paused — no new charges until you resume",
  resume: "Billing resumed",
  cancel_at_period_end: "Billing will stop at the end of the current period",
  cancel_now: "Billing stopped — subscription record kept for history",
  undo_cancel: "Scheduled billing stop removed",
};

export const SubscriptionBillingActionsDialog = ({
  subscription,
  open,
  onOpenChange,
  canPause,
  canResume,
  canCancel,
  canCancelDraft,
  canUndoCancel,
}: SubscriptionBillingActionsDialogProps) => {
  const notify = useNotify();
  const refresh = useRefresh();
  const dataProvider = useDataProvider<CrmDataProvider>();
  const [pendingAction, setPendingAction] = useState<BillingAction | null>(null);

  const manageMutation = useMutation({
    mutationFn: (action: BillingAction) =>
      dataProvider.manageClientSubscription({
        subscriptionId: subscription.id,
        action,
      }),
    onSuccess: (_result, action) => {
      refresh();
      onOpenChange(false);
      setPendingAction(null);
      notify(successMessages[action], { type: "success" });
    },
    onError: (error: Error) => {
      notify(error.message || "Could not update billing", { type: "error" });
    },
  });

  const periodEndLabel = subscription.current_period_end
    ? formatBillingDate(subscription.current_period_end.slice(0, 10))
    : "the end of the current period";

  const options: ActionOption[] = [
    ...(canPause
      ? [
          {
            action: "pause" as const,
            title: "Pause billing",
            description:
              "Temporarily stop charges. The subscription stays in your records and you can resume later.",
            icon: Pause,
          },
        ]
      : []),
    ...(canResume
      ? [
          {
            action: "resume" as const,
            title: "Resume billing",
            description: "Turn automatic charges back on for this subscription.",
            icon: Play,
          },
        ]
      : []),
    ...(canUndoCancel
      ? [
          {
            action: "undo_cancel" as const,
            title: "Keep billing active",
            description:
              "Remove the scheduled stop so renewals continue after the current period.",
            icon: RotateCcw,
          },
        ]
      : []),
    ...(canCancel && subscription.stripe_subscription_id
      ? [
          {
            action: "cancel_at_period_end" as const,
            title: "Stop at period end",
            description: `Stop future renewals after ${periodEndLabel}. The subscription record is kept; nothing is deleted.`,
            icon: CalendarClock,
          },
        ]
      : []),
    ...(canCancel || canCancelDraft
      ? [
          {
            action: "cancel_now" as const,
            title: canCancelDraft ? "Cancel before billing starts" : "Stop billing now",
            description: canCancelDraft
              ? "Mark this subscription as canceled before any charge runs. The record stays in the CRM for history."
              : "End billing immediately. The subscription record stays in the CRM — it is not deleted.",
            icon: OctagonX,
            destructive: true,
          },
        ]
      : []),
  ];

  const selectedOption = options.find(
    (option) => option.action === pendingAction,
  );

  const closeAll = () => {
    if (manageMutation.isPending) return;
    setPendingAction(null);
    onOpenChange(false);
  };

  return (
    <>
      <Dialog open={open && !pendingAction} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Manage billing</DialogTitle>
            <DialogDescription>
              Pause, resume, or stop charges for {subscription.name}. These
              actions never delete the subscription from your records.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-2">
            {options.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No billing actions are available for this subscription right now.
              </p>
            ) : (
              options.map(({ action, title, description, icon: Icon, destructive }) => (
                <button
                  key={action}
                  type="button"
                  className="flex w-full items-start gap-3 rounded-lg border p-4 text-left transition-colors hover:bg-muted/40"
                  onClick={() => setPendingAction(action)}
                >
                  <Icon
                    className={
                      destructive
                        ? "mt-0.5 size-5 text-destructive"
                        : "mt-0.5 size-5 text-muted-foreground"
                    }
                  />
                  <span className="min-w-0">
                    <span className="block text-sm font-medium">{title}</span>
                    <span className="mt-1 block text-xs text-muted-foreground">
                      {description}
                    </span>
                  </span>
                </button>
              ))
            )}
          </div>

          <DialogFooter>
            <Button type="button" variant="ghost" onClick={closeAll}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={Boolean(pendingAction && selectedOption)}
        onOpenChange={(nextOpen) => {
          if (!nextOpen && !manageMutation.isPending) {
            setPendingAction(null);
          }
        }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{selectedOption?.title}</DialogTitle>
            <DialogDescription>{selectedOption?.description}</DialogDescription>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            This does not delete the subscription from Sigma. Invoice history and
            client records stay intact.
          </p>
          <DialogFooter>
            <Button
              type="button"
              variant="ghost"
              disabled={manageMutation.isPending}
              onClick={() => setPendingAction(null)}
            >
              Back
            </Button>
            <Button
              type="button"
              variant={selectedOption?.destructive ? "destructive" : "primary"}
              disabled={!pendingAction || manageMutation.isPending}
              onClick={() => {
                if (!pendingAction) return;
                manageMutation.mutate(pendingAction);
              }}
            >
              {manageMutation.isPending ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  Working…
                </>
              ) : (
                "Confirm"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};
