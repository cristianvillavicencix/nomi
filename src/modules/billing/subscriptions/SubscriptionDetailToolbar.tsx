import { useMutation } from "@tanstack/react-query";
import {
  ChevronDown,
  Copy,
  CreditCard,
  Loader2,
  Mail,
  MessageSquare,
  OctagonX,
  Pause,
  Pencil,
  Play,
  RotateCcw,
  Save,
  Send,
  CalendarClock,
  Eye,
} from "lucide-react";
import { useSearchParams } from "react-router";
import { useState, type ComponentProps } from "react";
import { useDataProvider, useNotify, useRefresh } from "ra-core";
import type { CrmDataProvider } from "@/components/atomic-crm/providers/types";
import { formatBillingDate } from "@/modules/billing/billingDisplayUtils";
import { resolveSubscriptionSetupShareUrl } from "@/lib/publicAppUrl";
import {
  canShowSubscriptionSetupLink,
  formatSubscriptionAmountLabel,
  isSubscriptionExpired,
  subscriptionStatusLabel,
  subscriptionStatusVariant,
} from "@/modules/billing/subscriptions/subscriptionDisplayUtils";
import { formatPaymentMethodLabel } from "@/modules/billing/subscriptions/useClientSavedPaymentMethod";
import { SendSubscriptionSetupDialog } from "@/modules/billing/subscriptions/SendSubscriptionSetupDialog";
import { CollectSubscriptionPaymentDialog } from "@/modules/billing/subscriptions/CollectSubscriptionPaymentDialog";
import { FinishSubscriptionSetupDialog } from "@/modules/billing/subscriptions/FinishSubscriptionSetupDialog";
import { SubscriptionBillingActionsDialog, type BillingAction } from "@/modules/billing/subscriptions/SubscriptionBillingActionsDialog";
import { SubscriptionCollectPaymentMenu } from "@/modules/billing/subscriptions/SubscriptionCollectPaymentMenu";
import {
  buildSubscriptionDetailSearchParams,
  buildSubscriptionEditSearchParams,
  type SubscriptionSubview,
} from "@/modules/billing/subscriptions/billingNavigation";
import type { ClientSubscription } from "@/modules/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

type SubscriptionDetailToolbarProps = {
  subscription: ClientSubscription;
  activeSubview: SubscriptionSubview;
  isPending: boolean;
  onSave: () => void;
  canSave: boolean;
  className?: string;
};

const ToolbarButton = ({
  children,
  className,
  ...props
}: ComponentProps<typeof Button>) => (
  <Button
    type="button"
    variant="ghost"
    size="sm"
    className={cn(
      "h-8 gap-1.5 rounded-none px-2.5 text-xs font-medium",
      className,
    )}
    {...props}
  >
    {children}
  </Button>
);

const SubscriptionPendingSetupBanner = ({
  isPending,
  onFinishSetup,
}: {
  isPending?: boolean;
  onFinishSetup: () => void;
}) => (
  <div className="flex flex-col gap-3 rounded-lg border bg-muted/20 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
    <p className="text-sm text-muted-foreground">
      <span className="font-medium text-foreground">What&apos;s next?</span>{" "}
      The client can finish the setup link anytime. Or collect a card here and
      activate recurring billing.
    </p>
    <Button type="button" size="sm" disabled={isPending} onClick={onFinishSetup}>
      <CreditCard className="size-4" />
      Finish setup
    </Button>
  </div>
);

const SubscriptionPastDueBanner = ({
  isPending,
  onSendSetup,
}: {
  isPending?: boolean;
  onSendSetup: () => void;
}) => (
  <div className="flex flex-col gap-3 rounded-lg border border-destructive/20 bg-destructive/5 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
    <p className="text-sm text-muted-foreground">
      <span className="font-medium text-foreground">What&apos;s next?</span>{" "}
      Payment failed or no card on file. Send a new setup link or update the
      payment method.
    </p>
    <Button type="button" size="sm" disabled={isPending} onClick={onSendSetup}>
      <Send className="size-4" />
      Send setup link
    </Button>
  </div>
);

const SubscriptionPausedBanner = ({
  resumesAt,
}: {
  resumesAt?: string | null;
}) => (
  <div className="rounded-lg border border-violet-500/20 bg-violet-500/5 px-4 py-3">
    <p className="text-sm text-muted-foreground">
      <span className="font-medium text-foreground">Billing paused.</span>{" "}
      {resumesAt ? (
        <>
          Stripe will resume automatic charges on{" "}
          <span className="font-medium text-foreground">
            {formatBillingDate(resumesAt.slice(0, 10))}
          </span>
          . You can also resume anytime.
        </>
      ) : (
        <>
          Charges stay off until you click Resume. This is not a cancel — use
          Stop if you want billing to end permanently.
        </>
      )}
    </p>
  </div>
);

const SubscriptionScheduledCancelBanner = ({
  endsAt,
}: {
  endsAt?: string | null;
}) => (
  <div className="rounded-lg border border-amber-500/20 bg-amber-500/5 px-4 py-3">
    <p className="text-sm text-muted-foreground">
      <span className="font-medium text-foreground">What&apos;s next?</span>{" "}
      This subscription is scheduled to cancel
      {endsAt ? (
        <>
          {" "}
          on{" "}
          <span className="font-medium text-foreground">
            {formatBillingDate(endsAt.slice(0, 10))}
          </span>
        </>
      ) : null}
      . Use Undo cancel to keep billing active.
    </p>
  </div>
);

const SubscriptionExpiredBanner = ({
  isPending,
  onReactivate,
}: {
  isPending?: boolean;
  onReactivate: () => void;
}) => (
  <div className="flex flex-col gap-3 rounded-lg border bg-muted/20 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
    <p className="text-sm text-muted-foreground">
      <span className="font-medium text-foreground">What&apos;s next?</span>{" "}
      This subscription has expired. Reactivate to resume billing on the saved
      card or send a new setup link from Edit.
    </p>
    <Button type="button" size="sm" disabled={isPending} onClick={onReactivate}>
      <RotateCcw className="size-4" />
      Reactivate subscription
    </Button>
  </div>
);

const SubscriptionCanceledBanner = ({
  isPending,
  onReactivate,
}: {
  isPending?: boolean;
  onReactivate: () => void;
}) => (
  <div className="flex flex-col gap-3 rounded-lg border bg-muted/20 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
    <p className="text-sm text-muted-foreground">
      <span className="font-medium text-foreground">What&apos;s next?</span>{" "}
      This subscription is canceled. Reactivate to start billing again.
    </p>
    <Button type="button" size="sm" disabled={isPending} onClick={onReactivate}>
      <RotateCcw className="size-4" />
      Reactivate subscription
    </Button>
  </div>
);

export const SubscriptionDetailHeader = ({
  subscription,
}: {
  subscription: ClientSubscription;
}) => {
  const isActiveLike =
    subscription.status === "active" || subscription.status === "trialing";
  const showBillingMeta =
    isActiveLike && !subscription.cancel_at_period_end;
  const amountLabel = formatSubscriptionAmountLabel(
    Number(subscription.amount),
    subscription.currency,
    subscription.billing_interval,
  );
  const nextCharge = subscription.next_billing_at?.slice(0, 10);
  const cardLabel =
    subscription.payment_method_last4 ||
    subscription.payment_method_brand ||
    subscription.stripe_payment_method_id
      ? formatPaymentMethodLabel(
          subscription.payment_method_brand,
          subscription.payment_method_last4,
        )
      : null;

  return (
    <div className="space-y-1">
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="text-base font-semibold">{subscription.name}</h2>
        <Badge
          variant={subscriptionStatusVariant(subscription.status, subscription)}
        >
          {subscriptionStatusLabel(subscription.status, subscription)}
        </Badge>
      </div>
      <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-sm text-muted-foreground">
        {subscription.subscription_number ? (
          <span>#{subscription.subscription_number}</span>
        ) : null}
        {showBillingMeta && nextCharge ? (
          <>
            {subscription.subscription_number ? (
              <span aria-hidden>·</span>
            ) : null}
            <span>
              Next charge{" "}
              <span className="font-medium text-foreground">{amountLabel}</span>{" "}
              on{" "}
              <span className="font-medium text-foreground">
                {formatBillingDate(nextCharge)}
              </span>
            </span>
          </>
        ) : null}
        {showBillingMeta && !nextCharge ? (
          <>
            {subscription.subscription_number ? (
              <span aria-hidden>·</span>
            ) : null}
            <span>
              Billing{" "}
              <span className="font-medium text-foreground">{amountLabel}</span>
            </span>
          </>
        ) : null}
        {showBillingMeta && cardLabel ? (
          <>
            <span aria-hidden>·</span>
            <span className="font-medium text-foreground">{cardLabel}</span>
          </>
        ) : null}
      </div>
    </div>
  );
};

export const SubscriptionDetailToolbar = ({
  subscription,
  activeSubview,
  isPending,
  onSave,
  canSave,
  className,
}: SubscriptionDetailToolbarProps) => {
  const notify = useNotify();
  const refresh = useRefresh();
  const [, setSearchParams] = useSearchParams();
  const dataProvider = useDataProvider<CrmDataProvider>();
  const [sendOpen, setSendOpen] = useState(false);
  const [finishSetupOpen, setFinishSetupOpen] = useState(false);
  const [collectDialogMode, setCollectDialogMode] = useState<
    "saved_card" | "staff_card" | null
  >(null);
  const [billingConfirmAction, setBillingConfirmAction] =
    useState<BillingAction | null>(null);

  const manageMutation = useMutation({
    mutationFn: (
      input: Parameters<CrmDataProvider["manageClientSubscription"]>[0],
    ) => dataProvider.manageClientSubscription(input),
    onSuccess: () => {
      refresh();
      notify("Subscription updated", { type: "success" });
    },
    onError: (error: Error) => {
      notify(error.message || "Could not update subscription", { type: "error" });
    },
  });

  const status = subscription.status;
  const expired = isSubscriptionExpired(subscription);
  const isCanceled = status === "canceled";
  const isEditView = activeSubview === "edit";
  const busy = isPending || manageMutation.isPending;
  const canSaveChanges = isEditView && !isCanceled && !expired && canSave;
  const canSendSetup =
    status === "pending_setup" ||
    (status === "past_due" && !subscription.payment_method_last4);
  const canCollectPayment = status === "pending_setup" && !expired;
  const canPause = status === "active" && !subscription.cancel_at_period_end;
  const canResume = status === "paused";
  const canReactivate = isCanceled || expired;
  const canUndoCancel =
    Boolean(subscription.cancel_at_period_end) &&
    (status === "active" || status === "trialing");
  const canCancel =
    status === "active" ||
    status === "past_due" ||
    status === "paused" ||
    status === "trialing";
  const canCancelDraft =
    (status === "pending_setup" || status === "past_due") &&
    !subscription.stripe_subscription_id?.trim() &&
    !expired &&
    !isCanceled;
  const canStopBilling =
    (canCancel && Boolean(subscription.stripe_subscription_id)) ||
    canCancelDraft;

  const openEditTab = () => {
    setSearchParams(
      buildSubscriptionEditSearchParams(String(subscription.id)),
      { replace: true },
    );
  };

  const exitEditView = () => {
    setSearchParams(
      buildSubscriptionDetailSearchParams(String(subscription.id), "overview"),
      { replace: true },
    );
  };

  const copyCheckoutUrl = async () => {
    const shareUrl = resolveSubscriptionSetupShareUrl({
      setup_share_url: subscription.setup_share_url,
      setup_short_code: subscription.setup_short_code,
      enrollment_mode: subscription.enrollment_mode,
    });
    const url =
      shareUrl.endsWith("/sub/…") || shareUrl.endsWith("/sub-agree/…")
        ? subscription.setup_checkout_url?.trim()
        : shareUrl;
    if (!url) {
      notify(
        subscription.enrollment_mode === "agreement"
          ? "No agreement link yet. Send the agreement first."
          : "No setup link yet. Send a setup link first.",
        { type: "warning" },
      );
      return;
    }
    await navigator.clipboard.writeText(url);
    notify(
      subscription.enrollment_mode === "agreement"
        ? "Agreement link copied"
        : "Setup link copied",
      { type: "success" },
    );
  };

  const showSetupLink = canShowSubscriptionSetupLink(subscription);
  const showFinishSetup = canCollectPayment;

  const handleFinishSetupAction = (
    action: "saved_card" | "staff_card" | "request_setup",
  ) => {
    if (action === "request_setup") {
      setSendOpen(true);
      return;
    }
    setCollectDialogMode(action);
  };

  return (
    <>
      <FinishSubscriptionSetupDialog
        subscription={subscription}
        open={finishSetupOpen}
        onOpenChange={setFinishSetupOpen}
        onSelectAction={handleFinishSetupAction}
      />
      <SendSubscriptionSetupDialog
        subscription={subscription}
        open={sendOpen}
        onOpenChange={setSendOpen}
      />
      <CollectSubscriptionPaymentDialog
        subscription={subscription}
        mode={collectDialogMode}
        open={collectDialogMode !== null}
        onOpenChange={(open) => {
          if (!open) setCollectDialogMode(null);
        }}
      />
      <SubscriptionBillingActionsDialog
        subscription={subscription}
        confirmAction={billingConfirmAction}
        onOpenChange={(open) => {
          if (!open) setBillingConfirmAction(null);
        }}
        canCancelDraft={canCancelDraft}
      />
      <div className={cn("flex flex-col gap-3", className)}>
        <div className="flex flex-wrap items-center gap-0 divide-x rounded-md border bg-background">
          {canReactivate ? (
            <ToolbarButton
              disabled={busy}
              onClick={() =>
                manageMutation.mutate({
                  subscriptionId: subscription.id,
                  action: "reactivate",
                })
              }
            >
              <RotateCcw className="size-3.5" />
              Reactivate
            </ToolbarButton>
          ) : null}

          <ToolbarButton
            disabled={busy}
            onClick={() => openEditTab()}
            aria-pressed={isEditView}
            title={isEditView ? "Editing subscription" : "Edit subscription"}
            className={isEditView ? "bg-muted text-foreground" : undefined}
          >
            <Pencil className="size-3.5" />
            Edit
          </ToolbarButton>

          {isEditView && !isCanceled && !expired ? (
            <ToolbarButton disabled={busy} onClick={exitEditView}>
              Cancel
            </ToolbarButton>
          ) : null}

          {isEditView && !isCanceled && !expired ? (
            <ToolbarButton
              disabled={!canSaveChanges || busy}
              onClick={onSave}
              title="Save changes"
            >
              {busy && isPending ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : (
                <Save className="size-3.5" />
              )}
              Save
            </ToolbarButton>
          ) : null}

          {showFinishSetup ? (
            <ToolbarButton
              disabled={busy}
              onClick={() => setFinishSetupOpen(true)}
              className="bg-primary/10 text-foreground hover:bg-primary/15"
            >
              <CreditCard className="size-3.5" />
              Finish setup
            </ToolbarButton>
          ) : null}

          {canCollectPayment && !showFinishSetup ? (
            <SubscriptionCollectPaymentMenu
              subscription={subscription}
              disabled={busy}
              onUseSavedCard={() => setCollectDialogMode("saved_card")}
              onEnterStaffCard={() => setCollectDialogMode("staff_card")}
              onRequestClientCard={() => setSendOpen(true)}
            />
          ) : null}

          {canSendSetup &&
          (status !== "pending_setup" ||
            subscription.enrollment_mode === "agreement") ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <ToolbarButton disabled={busy}>
                  <Send className="size-3.5" />
                  Send
                  <ChevronDown className="size-3 opacity-60" />
                </ToolbarButton>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start">
                <DropdownMenuItem onSelect={() => setSendOpen(true)}>
                  <Mail className="size-4" />
                  {subscription.enrollment_mode === "agreement"
                    ? "Resend agreement by email"
                    : "Send setup link by email"}
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={() => setSendOpen(true)}>
                  <MessageSquare className="size-4" />
                  {subscription.enrollment_mode === "agreement"
                    ? "Resend agreement by SMS"
                    : "Send setup link by SMS"}
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={() => setSendOpen(true)}>
                  <Send className="size-4" />
                  Email + SMS
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : null}

          {showSetupLink ? (
            <ToolbarButton
              disabled={busy}
              onClick={() => void copyCheckoutUrl()}
              title={
                subscription.enrollment_mode === "agreement"
                  ? "Copy agreement link"
                  : "Copy setup link"
              }
            >
              <Copy className="size-3.5" />
              Copy link
            </ToolbarButton>
          ) : null}

          {showSetupLink &&
          subscription.enrollment_mode === "agreement" &&
          (subscription.setup_share_url?.trim() ||
            subscription.setup_short_code?.trim()) ? (
            <ToolbarButton
              disabled={busy}
              title="View as client"
              aria-label="View as client"
              onClick={() => {
                const openUrl =
                  subscription.setup_share_url?.trim() ||
                  `${window.location.origin}/sub-agree/${subscription.setup_short_code}`;
                window.open(openUrl, "_blank", "noopener,noreferrer");
              }}
            >
              <Eye className="size-3.5" />
            </ToolbarButton>
          ) : null}

          {canPause ? (
            <ToolbarButton
              disabled={busy}
              onClick={() => setBillingConfirmAction("pause")}
              title="Pause billing"
            >
              <Pause className="size-3.5" />
              Pause
            </ToolbarButton>
          ) : null}

          {canResume ? (
            <ToolbarButton
              disabled={busy}
              onClick={() => setBillingConfirmAction("resume")}
              title="Resume billing"
            >
              <Play className="size-3.5" />
              Resume
            </ToolbarButton>
          ) : null}

          {canUndoCancel ? (
            <ToolbarButton
              disabled={busy}
              onClick={() => setBillingConfirmAction("undo_cancel")}
              title="Keep billing active"
            >
              <RotateCcw className="size-3.5" />
              Undo cancel
            </ToolbarButton>
          ) : null}

          {canStopBilling ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <ToolbarButton disabled={busy} title="Stop billing">
                  <OctagonX className="size-3.5" />
                  Stop
                  <ChevronDown className="size-3 opacity-60" />
                </ToolbarButton>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start">
                {canCancel && subscription.stripe_subscription_id ? (
                  <DropdownMenuItem
                    onSelect={() =>
                      setBillingConfirmAction("cancel_at_period_end")
                    }
                  >
                    <CalendarClock className="size-4" />
                    Stop at period end
                  </DropdownMenuItem>
                ) : null}
                <DropdownMenuItem
                  variant="destructive"
                  onSelect={() => setBillingConfirmAction("cancel_now")}
                >
                  <OctagonX className="size-4" />
                  {canCancelDraft
                    ? "Cancel before billing starts"
                    : "Stop billing now"}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : null}
        </div>

        {status === "pending_setup" ? (
          <SubscriptionPendingSetupBanner
            isPending={busy}
            onFinishSetup={() => setFinishSetupOpen(true)}
          />
        ) : null}

        {status === "past_due" && !subscription.payment_method_last4 ? (
          <SubscriptionPastDueBanner
            isPending={busy}
            onSendSetup={() => setSendOpen(true)}
          />
        ) : null}

        {status === "paused" ? (
          <SubscriptionPausedBanner
            resumesAt={subscription.pause_resumes_at}
          />
        ) : null}

        {subscription.cancel_at_period_end &&
        (status === "active" || status === "trialing") ? (
          <SubscriptionScheduledCancelBanner
            endsAt={subscription.current_period_end}
          />
        ) : null}

        {expired && !isCanceled ? (
          <SubscriptionExpiredBanner
            isPending={busy}
            onReactivate={() =>
              manageMutation.mutate({
                subscriptionId: subscription.id,
                action: "reactivate",
              })
            }
          />
        ) : null}

        {isCanceled ? (
          <SubscriptionCanceledBanner
            isPending={busy}
            onReactivate={() =>
              manageMutation.mutate({
                subscriptionId: subscription.id,
                action: "reactivate",
              })
            }
          />
        ) : null}
      </div>
    </>
  );
};
