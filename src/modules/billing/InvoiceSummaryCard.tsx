import { useQuery } from "@tanstack/react-query";
import { Eye, Link2, Loader2 } from "lucide-react";
import { useDataProvider, useNotify } from "ra-core";
import type { CrmDataProvider } from "@/components/atomic-crm/providers/types";
import { formatBillingDate } from "@/modules/billing/billingDisplayUtils";
import { resolveClientInvoiceShareUrl } from "@/modules/billing/invoiceEmailTemplate";
import { invoiceListTotals } from "@/modules/billing/invoicePaymentUtils";
import {
  invoiceStatusSidebarLabel,
  invoiceStatusSidebarVariant,
} from "@/modules/billing/invoiceStatusSidebarLabel";
import { resolveInvoiceStatusRibbon } from "@/modules/billing/invoiceStatusRibbon";
import type { ClientInvoice } from "@/modules/types";
import { Badge } from "@/components/ui/badge";
import { IconButton } from "@/components/ui/icon-button";
import { MoneyText } from "@/lib/permissions/MoneyText";
import { cn } from "@/lib/utils";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

type InvoiceSummaryCardProps = {
  invoice: ClientInvoice;
  /** Optional customer line (ticket context often already shows the client). */
  companyName?: string | null;
  onView?: () => void;
  className?: string;
};

/**
 * Compact invoice card shared by billing lists and ticket Billing tab.
 * Status corner ribbon matches document preview; payment link copies on click.
 */
export const InvoiceSummaryCard = ({
  invoice,
  companyName,
  onView,
  className,
}: InvoiceSummaryCardProps) => {
  const notify = useNotify();
  const dataProvider = useDataProvider<CrmDataProvider>();
  const { total, balance, isPartial } = invoiceListTotals(invoice);
  const statusLabel = invoiceStatusSidebarLabel(
    invoice.status,
    invoice.due_date,
    { isPartial },
  );
  const ribbon = resolveInvoiceStatusRibbon(invoice);
  const canCopyPaymentLink = invoice.status === "sent";

  const { data: shareLink, isPending: linkPending } = useQuery({
    queryKey: ["invoice-summary-payment-link", invoice.id],
    queryFn: () =>
      dataProvider.shareClientInvoice({
        invoiceId: Number(invoice.id),
        baseUrl: window.location.origin,
      }),
    enabled: canCopyPaymentLink && invoice.id != null,
    staleTime: 60_000,
  });

  const paymentUrl = shareLink
    ? resolveClientInvoiceShareUrl(shareLink, window.location.origin)
    : "";

  const copyPaymentLink = async () => {
    if (linkPending) {
      notify("Payment link is not ready yet", { type: "warning" });
      return;
    }
    if (!paymentUrl) {
      notify("Payment link unavailable", { type: "warning" });
      return;
    }
    try {
      await navigator.clipboard.writeText(paymentUrl);
      notify("Payment link copied", { type: "info" });
    } catch {
      notify("Could not copy link", { type: "error" });
    }
  };

  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-lg border bg-background p-3 shadow-sm",
        className,
      )}
    >
      {ribbon ? (
        <div
          className="pointer-events-none absolute bottom-0 right-0 z-[1] size-14 overflow-hidden"
          aria-label={ribbon.label}
        >
          <span
            className={cn(
              "absolute bottom-[0.85rem] -right-6 w-[5.75rem] -rotate-45 py-px text-center text-[8px] font-bold uppercase tracking-wider shadow-sm",
              ribbon.className,
            )}
          >
            {ribbon.label}
          </span>
        </div>
      ) : null}

      <div className="relative z-[2] flex flex-col gap-2 pr-6">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="truncate text-sm font-medium">
              {invoice.invoice_number?.trim() || `Invoice #${invoice.id}`}
            </p>
            {companyName ? (
              <p className="mt-0.5 truncate text-xs text-muted-foreground">
                {companyName}
              </p>
            ) : null}
          </div>
          <div className="shrink-0 text-right">
            <p className="text-sm font-semibold tabular-nums">
              <MoneyText value={isPartial ? balance : total} />
            </p>
            {isPartial ? (
              <p className="text-[10px] text-muted-foreground">
                of <MoneyText value={total} />
              </p>
            ) : null}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Badge
            variant={invoiceStatusSidebarVariant(
              invoice.status,
              invoice.due_date,
            )}
            className="w-fit text-[10px] uppercase tracking-wide"
          >
            {statusLabel}
          </Badge>
          {invoice.issue_date ? (
            <span className="text-[11px] text-muted-foreground">
              {formatBillingDate(invoice.issue_date)}
            </span>
          ) : null}
        </div>

        <div className="flex items-center gap-0.5">
          {canCopyPaymentLink ? (
            <Tooltip>
              <TooltipTrigger asChild>
                <IconButton
                  aria-label="Copy payment link"
                  disabled={linkPending && !paymentUrl}
                  onClick={() => void copyPaymentLink()}
                >
                  {linkPending && !paymentUrl ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <Link2 className="size-4" />
                  )}
                </IconButton>
              </TooltipTrigger>
              <TooltipContent side="bottom">Copy payment link</TooltipContent>
            </Tooltip>
          ) : null}

          {onView ? (
            <Tooltip>
              <TooltipTrigger asChild>
                <IconButton aria-label="View invoice" onClick={onView}>
                  <Eye className="size-4" />
                </IconButton>
              </TooltipTrigger>
              <TooltipContent side="bottom">View invoice</TooltipContent>
            </Tooltip>
          ) : null}
        </div>
      </div>
    </div>
  );
};
