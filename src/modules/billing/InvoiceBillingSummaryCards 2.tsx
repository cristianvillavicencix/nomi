import { useMemo } from "react";
import { useGetList } from "ra-core";
import { formatInvoiceMoney } from "@/modules/billing/invoiceEmailTemplate";
import {
  computeInvoiceBillingSummary,
  type InvoiceBillingSummaryBucket,
} from "@/modules/billing/invoiceBillingSummary";
import type { InvoiceStatusFilter } from "@/modules/billing/billingDisplayUtils";
import type { ClientInvoice } from "@/modules/types";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

type InvoiceBillingSummaryCardsProps = {
  statusFilter: InvoiceStatusFilter;
  onStatusFilterChange: (next: InvoiceStatusFilter) => void;
  className?: string;
};

type SummaryCardProps = {
  label: string;
  hint?: string;
  bucket: InvoiceBillingSummaryBucket;
  active: boolean;
  tone?: "default" | "destructive";
  onClick: () => void;
};

const SummaryCard = ({
  label,
  hint,
  bucket,
  active,
  tone = "default",
  onClick,
}: SummaryCardProps) => (
  <button
    type="button"
    onClick={onClick}
    className={cn(
      "flex min-w-0 flex-col rounded-lg border bg-background px-3 py-2.5 text-left transition-colors hover:bg-muted/40",
      active &&
        tone === "default" &&
        "border-primary/40 bg-primary/5 ring-1 ring-primary/15",
      active &&
        tone === "destructive" &&
        "border-destructive/40 bg-destructive/5 ring-1 ring-destructive/15",
    )}
  >
    <span className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
      {label}
    </span>
    <span
      className={cn(
        "mt-0.5 truncate text-lg font-semibold tabular-nums",
        tone === "destructive" && bucket.count > 0 && "text-destructive",
      )}
    >
      {formatInvoiceMoney(bucket.amount)}
    </span>
    <span className="mt-0.5 text-[11px] text-muted-foreground">
      {bucket.count === 1 ? "1 invoice" : `${bucket.count} invoices`}
      {hint ? ` · ${hint}` : null}
    </span>
  </button>
);

const SummaryCardSkeleton = () => (
  <div className="rounded-lg border bg-background px-3 py-2.5">
    <Skeleton className="h-3 w-16" />
    <Skeleton className="mt-2 h-6 w-24" />
    <Skeleton className="mt-2 h-3 w-20" />
  </div>
);

export const InvoiceBillingSummaryCards = ({
  statusFilter,
  onStatusFilterChange,
  className,
}: InvoiceBillingSummaryCardsProps) => {
  const { data: invoices = [], isPending } = useGetList<ClientInvoice>(
    "client_invoices",
    {
      pagination: { page: 1, perPage: 1000 },
      sort: { field: "issue_date", order: "DESC" },
      filter: {},
    },
    { staleTime: 30_000 },
  );

  const summary = useMemo(
    () => computeInvoiceBillingSummary(invoices),
    [invoices],
  );

  if (isPending) {
    return (
      <div
        className={cn(
          "grid grid-cols-2 gap-2 md:grid-cols-4 md:gap-3",
          className,
        )}
      >
        {Array.from({ length: 4 }).map((_, index) => (
          <SummaryCardSkeleton key={index} />
        ))}
      </div>
    );
  }

  return (
    <div
      className={cn(
        "grid grid-cols-2 gap-2 md:grid-cols-4 md:gap-3",
        className,
      )}
    >
      <SummaryCard
        label="Outstanding"
        bucket={summary.outstanding}
        active={statusFilter === "sent"}
        onClick={() => onStatusFilterChange("sent")}
      />
      <SummaryCard
        label="Overdue"
        bucket={summary.overdue}
        active={statusFilter === "overdue"}
        tone="destructive"
        onClick={() => onStatusFilterChange("overdue")}
      />
      <SummaryCard
        label="Paid"
        hint="30 days"
        bucket={summary.paid30d}
        active={statusFilter === "paid"}
        onClick={() => onStatusFilterChange("paid")}
      />
      <SummaryCard
        label="Draft"
        bucket={summary.draft}
        active={statusFilter === "draft"}
        onClick={() => onStatusFilterChange("draft")}
      />
    </div>
  );
};
