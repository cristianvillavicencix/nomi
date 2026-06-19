import { FileText } from "lucide-react";
import type { ClientInvoice } from "@/modules/types";
import { formatSupplementMoney } from "@/modules/tickets/supplementPricing";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type TicketToolsInvoiceSectionProps = {
  invoice: ClientInvoice;
  onView: () => void;
};

const invoiceStatusBadge = (status?: string | null) => {
  switch (status) {
    case "paid":
      return {
        label: "Paid",
        className: "border-emerald-200 text-emerald-700",
      };
    case "sent":
      return {
        label: "Unpaid",
        className: "border-amber-200 text-amber-700",
      };
    case "void":
      return {
        label: "Void",
        className: "border-border text-muted-foreground",
      };
    default:
      return {
        label: status ?? "Draft",
        className: "border-border text-muted-foreground",
      };
  }
};

export const TicketToolsInvoiceSection = ({
  invoice,
  onView,
}: TicketToolsInvoiceSectionProps) => {
  const badge = invoiceStatusBadge(invoice.status);
  const amount = Number(invoice.amount) || 0;
  const paidAt = invoice.paid_at ? new Date(invoice.paid_at) : null;

  return (
    <div className="space-y-3">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate text-sm font-medium">
            {invoice.invoice_number || `Invoice #${invoice.id}`}
          </p>
          <p className="mt-0.5 text-2xl font-semibold tabular-nums tracking-tight">
            {formatSupplementMoney(amount)}
          </p>
        </div>
        <Badge variant="outline" className={cn("shrink-0", badge.className)}>
          {badge.label}
        </Badge>
      </div>

      {paidAt ? (
        <p className="text-xs text-muted-foreground">
          Paid {paidAt.toLocaleString()}
        </p>
      ) : invoice.due_date ? (
        <p className="text-xs text-muted-foreground">
          Due {new Date(`${invoice.due_date}T12:00:00`).toLocaleDateString()}
        </p>
      ) : null}

      <Button type="button" variant="outline" size="sm" className="w-full" onClick={onView}>
        <FileText className="mr-1.5 size-3.5" />
        View invoice
      </Button>
    </div>
  );
};
