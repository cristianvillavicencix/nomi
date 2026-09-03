import { useMutation } from "@tanstack/react-query";
import {
  Ban,
  CheckCircle2,
  ChevronDown,
  Clock,
  CreditCard,
  ExternalLink,
  FileDown,
  FileText,
  Loader2,
  Mail,
  MessageSquare,
  MoreHorizontal,
  Package,
  Pencil,
  Receipt,
  Save,
  Send,
  Settings2,
  Trash2,
} from "lucide-react";
import { type ComponentProps, useState } from "react";
import { useDataProvider, useNotify } from "ra-core";
import { Link } from "react-router";

import type { CrmDataProvider } from "@/components/atomic-crm/providers/types";
import {
  canDeleteClientInvoice,
  canMarkClientInvoiceSent,
  canSendClientInvoice,
  canVoidClientInvoice,
} from "@/modules/billing/billingUtils";
import type { InvoiceCreateAction } from "@/modules/billing/InvoiceCreateActions";
import { formatSendTimeDisplay } from "@/modules/billing/invoiceScheduleUtils";
import { formatInvoiceMoney } from "@/modules/billing/invoiceEmailTemplate";
import { isClientInvoiceOverdue } from "@/modules/billing/billingDisplayUtils";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { ClientInvoice } from "@/modules/types";
import { cn } from "@/lib/utils";
import { InvoiceSendHistory } from "@/modules/billing/InvoiceSendHistory";
import { VoidInvoiceReasonDialog } from "@/modules/billing/VoidInvoiceReasonDialog";

export type InvoiceSendChannel = "email" | "sms" | "both";

type InvoiceDetailToolbarProps = {
  invoice: ClientInvoice;
  isPending: boolean;
  pendingAction: InvoiceCreateAction | null;
  onAction: (action: InvoiceCreateAction) => void;
  onSendWithChannel: (channel: InvoiceSendChannel) => void;
  onEdit?: () => void;
  editLocked?: boolean;
  onScheduleSend?: () => void;
  onConfigurePayment?: () => void;
  showCharge?: boolean;
  onCharge?: () => void;
  balanceDue?: number;
  showResendReceipt?: boolean;
  onResendReceipt?: () => void;
  pendingResend?: boolean;
  cancelTo?: string;
  showCancel?: boolean;
  onRefresh?: () => void;
  onDeleted?: () => void;
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

const formatScheduledSendLabel = (value: string) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  const dateLabel = date.toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
  const timeLabel = formatSendTimeDisplay(
    `${date.getHours()}:${String(date.getMinutes()).padStart(2, "0")}`,
  );
  return `${dateLabel} at ${timeLabel}`;
};

const deliveryStatusConfig: Record<
  string,
  { label: string; className: string }
> = {
  pending_payment: {
    label: "Awaiting payment",
    className: "text-amber-600 bg-amber-50",
  },
  payment_processing: {
    label: "Payment processing",
    className: "text-primary bg-primary/10",
  },
  payment_received: {
    label: "Payment received",
    className: "text-emerald-600 bg-emerald-50",
  },
  delivering_files: {
    label: "Delivering files",
    className: "text-primary bg-primary/10",
  },
  delivery_succeeded: {
    label: "Files delivered",
    className: "text-emerald-600 bg-emerald-50",
  },
  delivery_failed: {
    label: "Delivery failed",
    className: "text-destructive bg-destructive/10",
  },
  delivery_manually_sent: {
    label: "Files sent manually",
    className: "text-muted-foreground bg-muted",
  },
};

const InvoiceDeliveryStatusBadge = ({
  status,
  errorMessage,
}: {
  status: string | null;
  errorMessage?: string | null;
}) => {
  if (!status || status === "pending_payment") return null;
  const config = deliveryStatusConfig[status] || {
    label: status,
    className: "text-muted-foreground bg-muted",
  };

  return (
    <div
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium",
        config.className,
      )}
      title={errorMessage || undefined}
    >
      <Package className="size-3.5" />
      {config.label}
      {status === "delivery_failed" && errorMessage ? (
        <span className="max-w-[180px] truncate font-normal opacity-80">
          — {errorMessage}
        </span>
      ) : null}
    </div>
  );
};

export const InvoiceDraftWhatsNextBanner = ({
  onSend,
  onMarkSent,
  isPending,
}: {
  onSend: () => void;
  onMarkSent: () => void;
  isPending?: boolean;
}) => (
  <div className="flex flex-col gap-3 rounded-lg border bg-muted/20 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
    <p className="text-sm text-muted-foreground">
      <span className="font-medium text-foreground">What&apos;s next?</span>{" "}
      Send this invoice to your customer or mark it as sent.
    </p>
    <div className="flex shrink-0 flex-col gap-2 sm:flex-row">
      <Button type="button" size="sm" disabled={isPending} onClick={onSend}>
        <Send className="size-4" />
        Send invoice
      </Button>
      <Button
        type="button"
        size="sm"
        variant="secondary"
        disabled={isPending}
        onClick={onMarkSent}
      >
        <CheckCircle2 className="size-4" />
        Mark as sent
      </Button>
    </div>
  </div>
);

export const InvoiceOverdueWhatsNextBanner = ({
  balanceDue = 0,
  isPending,
  onCharge,
  onConfigurePayment,
  onSend,
}: {
  balanceDue?: number;
  isPending?: boolean;
  onCharge?: () => void;
  onConfigurePayment?: () => void;
  onSend?: () => void;
}) => (
  <div className="flex flex-col gap-3 rounded-lg border border-destructive/20 bg-destructive/5 px-4 py-3">
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <p className="text-sm text-muted-foreground">
        <span className="font-medium text-foreground">What&apos;s next?</span>{" "}
        Payment is overdue.
        {balanceDue > 0.01 ? (
          <>
            {" "}
            <span className="font-medium text-foreground">
              {formatInvoiceMoney(balanceDue)}
            </span>{" "}
            is still due — record payment or resend the invoice.
          </>
        ) : (
          <> Record payment or resend the invoice.</>
        )}
      </p>
      <div className="flex shrink-0 flex-col gap-2 sm:flex-row">
        {onSend ? (
          <Button
            type="button"
            size="sm"
            variant="secondary"
            disabled={isPending}
            onClick={onSend}
          >
            <Send className="size-4" />
            Resend invoice
          </Button>
        ) : null}
        {onCharge ? (
          <Button
            type="button"
            size="sm"
            disabled={isPending}
            onClick={onCharge}
          >
            <CreditCard className="size-4" />
            Record payment
          </Button>
        ) : null}
      </div>
    </div>
    {onConfigurePayment ? (
      <p className="text-sm text-muted-foreground">
        Online payments:{" "}
        <span className="font-medium text-foreground">Stripe</span>
        <Button
          type="button"
          variant="link"
          size="sm"
          className="h-auto px-1.5 py-0 text-sm"
          disabled={isPending}
          onClick={onConfigurePayment}
        >
          Change
        </Button>
      </p>
    ) : null}
  </div>
);

export const InvoiceSentWhatsNextBanner = ({
  invoice,
  balanceDue = 0,
  pendingResend = false,
  isPending,
  onSend,
  onCharge,
  onConfigurePayment,
}: {
  invoice: ClientInvoice;
  balanceDue?: number;
  pendingResend?: boolean;
  isPending?: boolean;
  onSend: () => void;
  onCharge?: () => void;
  onConfigurePayment?: () => void;
}) => {
  const scheduledSendAt = invoice.scheduled_send_at?.trim();
  const showBalanceDue = balanceDue > 0.01;
  const showPaymentGateway = Boolean(onConfigurePayment);

  if (
    !pendingResend &&
    !scheduledSendAt &&
    !showBalanceDue &&
    !showPaymentGateway
  ) {
    return null;
  }

  return (
    <div className="flex flex-col gap-3 rounded-lg border bg-muted/20 px-4 py-3">
      {pendingResend ? (
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-muted-foreground">
            <span className="font-medium text-foreground">
              What&apos;s next?
            </span>{" "}
            You updated this invoice — resend it so your customer sees the
            latest version.
          </p>
          <Button type="button" size="sm" disabled={isPending} onClick={onSend}>
            <Send className="size-4" />
            Resend invoice
          </Button>
        </div>
      ) : null}

      {scheduledSendAt ? (
        <p className="text-sm text-muted-foreground">
          <span className="font-medium text-foreground">What&apos;s next?</span>{" "}
          Invoice send is scheduled for{" "}
          <span className="font-medium text-foreground">
            {formatScheduledSendLabel(scheduledSendAt)}
          </span>
          .
        </p>
      ) : null}

      {showBalanceDue ? (
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-muted-foreground">
            {pendingResend || scheduledSendAt ? null : (
              <>
                <span className="font-medium text-foreground">
                  What&apos;s next?
                </span>{" "}
              </>
            )}
            Waiting for payment
            {balanceDue > 0 ? (
              <>
                {" "}
                —{" "}
                <span className="font-medium text-foreground">
                  {formatInvoiceMoney(balanceDue, invoice.currency ?? "USD")}
                </span>{" "}
                balance due
              </>
            ) : null}
            .
          </p>
          {onCharge ? (
            <div className="flex shrink-0 items-center gap-2">
              <span className="text-sm text-muted-foreground">
                Received payment?
              </span>
              <Button
                type="button"
                size="sm"
                disabled={isPending}
                onClick={onCharge}
              >
                <CreditCard className="size-4" />
                Record payment
              </Button>
            </div>
          ) : null}
        </div>
      ) : null}

      {showPaymentGateway ? (
        <p className="text-sm text-muted-foreground">
          Online payments:{" "}
          <span className="font-medium text-foreground">Stripe</span>
          <Button
            type="button"
            variant="link"
            size="sm"
            className="h-auto px-1.5 py-0 text-sm"
            disabled={isPending}
            onClick={onConfigurePayment}
          >
            Change
          </Button>
        </p>
      ) : null}
    </div>
  );
};

export const InvoiceDetailToolbar = ({
  invoice,
  isPending,
  pendingAction,
  onAction,
  onSendWithChannel,
  onEdit,
  editLocked = false,
  onScheduleSend,
  onConfigurePayment,
  showCharge,
  onCharge,
  balanceDue = 0,
  showResendReceipt = false,
  onResendReceipt,
  pendingResend = false,
  cancelTo = "/billing",
  showCancel = true,
  onRefresh,
  onDeleted,
  className,
}: InvoiceDetailToolbarProps) => {
  const notify = useNotify();
  const dataProvider = useDataProvider<CrmDataProvider>();
  const [voidReasonOpen, setVoidReasonOpen] = useState(false);

  const showSend = canSendClientInvoice(invoice);
  const showMarkSent = canMarkClientInvoiceSent(invoice);
  const showVoid = canVoidClientInvoice(invoice);
  const showDelete = canDeleteClientInvoice(invoice);
  const isDraft = invoice.status === "draft";
  const isSent = invoice.status === "sent";
  const isPaid = invoice.status === "paid";
  const isOverdue = isClientInvoiceOverdue(invoice);

  const manageMutation = useMutation({
    mutationFn: ({
      action,
      voidReason,
    }: {
      action: "mark_sent" | "void" | "delete";
      voidReason?: string;
    }) =>
      dataProvider.manageClientInvoice({
        invoiceId: invoice.id,
        action,
        voidReason,
      }),
    onSuccess: (_data, { action }) => {
      if (action === "void") {
        setVoidReasonOpen(false);
      }
      if (action === "mark_sent") {
        notify("Invoice marked as sent", { type: "success" });
        onRefresh?.();
        return;
      }
      if (action === "void") {
        notify("Invoice voided", { type: "success" });
        onRefresh?.();
        return;
      }
      notify("Invoice deleted", { type: "success" });
      onDeleted?.();
    },
    onError: (error: Error) => {
      notify(error.message || "Could not update invoice", { type: "error" });
    },
  });

  const handleManage = (action: "mark_sent" | "void" | "delete") => {
    if (action === "void") {
      setVoidReasonOpen(true);
      return;
    }
    if (action === "delete") {
      const confirmed = window.confirm(
        `Delete invoice ${invoice.invoice_number}? This cannot be undone.`,
      );
      if (!confirmed) return;
    }
    manageMutation.mutate({ action });
  };

  const busy = isPending || manageMutation.isPending;
  const isSaving =
    isPending && (pendingAction === "draft" || pendingAction === "update");
  const showRecordPayment =
    !isPaid && Boolean(showCharge && onCharge && (isSent || balanceDue > 0.01));
  const showPaidSendMenu = isPaid && showResendReceipt && onResendReceipt;
  const showMoreActions =
    (showMarkSent ||
      onConfigurePayment ||
      (!isPaid && showResendReceipt && onResendReceipt) ||
      showVoid ||
      showDelete) &&
    !isPaid;

  const handleEditClick = () => {
    if (isDraft) {
      onAction("draft");
      return;
    }
    if (isSent && editLocked && onEdit) {
      onEdit();
      return;
    }
    if (isSent && !editLocked) {
      onAction("update");
    }
  };

  return (
    <div className={cn("flex flex-col gap-3", className)}>
      <div className="flex flex-wrap items-center gap-0 divide-x rounded-md border bg-background">
        {isDraft ? (
          <ToolbarButton
            disabled={busy}
            onClick={() => onAction("draft")}
            title="Save draft"
          >
            {isSaving ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : (
              <Save className="size-3.5" />
            )}
            Save
          </ToolbarButton>
        ) : (
          <ToolbarButton
            disabled={busy || isPaid || (isSent && editLocked && !onEdit)}
            onClick={handleEditClick}
            title={
              isPaid
                ? "Paid invoices cannot be edited"
                : isSent && editLocked
                  ? "Edit invoice"
                  : isSent
                    ? "Save changes"
                    : "Edit invoice"
            }
          >
            {isSaving ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : (
              <Pencil className="size-3.5" />
            )}
            {isSent && !editLocked ? "Save" : "Edit"}
          </ToolbarButton>
        )}

        {showSend ? (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <ToolbarButton disabled={busy}>
                <Send className="size-3.5" />
                Send
                <ChevronDown className="size-3 opacity-60" />
              </ToolbarButton>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start">
              <DropdownMenuItem onSelect={() => onSendWithChannel("email")}>
                <Mail className="size-4" />
                Send by email
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => onSendWithChannel("sms")}>
                <MessageSquare className="size-4" />
                Send by SMS
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => onSendWithChannel("both")}>
                <Send className="size-4" />
                Email + SMS
              </DropdownMenuItem>
              {onScheduleSend ? (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onSelect={onScheduleSend}>
                    <Clock className="size-4" />
                    Schedule send
                  </DropdownMenuItem>
                </>
              ) : null}
            </DropdownMenuContent>
          </DropdownMenu>
        ) : null}

        {showPaidSendMenu ? (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <ToolbarButton disabled={busy}>
                <Send className="size-3.5" />
                Send
                <ChevronDown className="size-3 opacity-60" />
              </ToolbarButton>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start">
              <DropdownMenuItem onSelect={onResendReceipt}>
                <Receipt className="size-4" />
                Resend receipt
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        ) : null}

        <ToolbarButton disabled={busy} onClick={() => onAction("share")}>
          <ExternalLink className="size-3.5" />
          Share
        </ToolbarButton>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <ToolbarButton disabled={busy}>
              <FileText className="size-3.5" />
              PDF / Print
              <ChevronDown className="size-3 opacity-60" />
            </ToolbarButton>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start">
            <DropdownMenuItem onSelect={() => onAction("print")}>
              <FileDown className="size-4" />
              Download PDF
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        {showRecordPayment ? (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <ToolbarButton disabled={busy}>
                <CreditCard className="size-3.5" />
                Record payment
                <ChevronDown className="size-3 opacity-60" />
              </ToolbarButton>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start">
              <DropdownMenuItem onSelect={onCharge}>
                <CreditCard className="size-4" />
                Collect payment
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        ) : null}

        {showMoreActions ? (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <ToolbarButton disabled={busy} aria-label="More invoice actions">
                <MoreHorizontal className="size-3.5" />
              </ToolbarButton>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              {showMarkSent ? (
                <DropdownMenuItem onSelect={() => handleManage("mark_sent")}>
                  <CheckCircle2 className="size-4" />
                  Mark as sent
                </DropdownMenuItem>
              ) : null}
              {onConfigurePayment ? (
                <DropdownMenuItem onSelect={onConfigurePayment}>
                  <Settings2 className="size-4" />
                  Payment settings
                </DropdownMenuItem>
              ) : null}
              {showResendReceipt && onResendReceipt ? (
                <DropdownMenuItem onSelect={onResendReceipt}>
                  <Receipt className="size-4" />
                  Resend receipt
                </DropdownMenuItem>
              ) : null}
              {(showVoid || showDelete) &&
              (showMarkSent || onConfigurePayment || showResendReceipt) ? (
                <DropdownMenuSeparator />
              ) : null}
              {showVoid ? (
                <DropdownMenuItem
                  variant="destructive"
                  onSelect={() => handleManage("void")}
                >
                  <Ban className="size-4" />
                  Void
                </DropdownMenuItem>
              ) : null}
              {showDelete ? (
                <DropdownMenuItem
                  variant="destructive"
                  onSelect={() => handleManage("delete")}
                >
                  <Trash2 className="size-4" />
                  Delete
                </DropdownMenuItem>
              ) : null}
            </DropdownMenuContent>
          </DropdownMenu>
        ) : null}

        {showCancel ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="ml-auto h-8 rounded-none px-3 text-xs"
            asChild
          >
            <Link to={cancelTo} aria-disabled={busy} tabIndex={busy ? -1 : 0}>
              Close
            </Link>
          </Button>
        ) : null}
      </div>

      <InvoiceDeliveryStatusBadge
        status={invoice.delivery_status}
        errorMessage={invoice.delivery_error_message}
      />

      {isDraft ? (
        <InvoiceDraftWhatsNextBanner
          isPending={busy}
          onSend={() => onSendWithChannel("both")}
          onMarkSent={() => handleManage("mark_sent")}
        />
      ) : null}

      {isSent && !isPaid ? (
        isOverdue ? (
          <InvoiceOverdueWhatsNextBanner
            balanceDue={balanceDue}
            isPending={busy}
            onSend={() => onSendWithChannel("both")}
            onCharge={onCharge}
            onConfigurePayment={onConfigurePayment}
          />
        ) : (
          <InvoiceSentWhatsNextBanner
            invoice={invoice}
            balanceDue={balanceDue}
            pendingResend={pendingResend}
            isPending={busy}
            onSend={() => onSendWithChannel("both")}
            onCharge={onCharge}
            onConfigurePayment={onConfigurePayment}
          />
        )
      ) : null}

      {invoice.status !== "draft" ? (
        <InvoiceSendHistory invoice={invoice} />
      ) : null}

      <VoidInvoiceReasonDialog
        open={voidReasonOpen}
        invoiceNumber={invoice.invoice_number}
        pending={manageMutation.isPending}
        onOpenChange={setVoidReasonOpen}
        onConfirm={(voidReason) =>
          manageMutation.mutate({ action: "void", voidReason })
        }
      />
    </div>
  );
};
