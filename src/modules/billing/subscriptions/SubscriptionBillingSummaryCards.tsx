import { useMemo } from "react";
import { useGetList } from "ra-core";
import { formatInvoiceMoney } from "@/modules/billing/invoiceEmailTemplate";
import {
  computeSubscriptionBillingSummary,
  type SubscriptionBillingSummaryBucket,
} from "@/modules/billing/subscriptions/subscriptionBillingSummary";
import type { SubscriptionStatusFilter } from "@/modules/billing/subscriptions/subscriptionDisplayUtils";
import type { ClientSubscription } from "@/modules/types";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

type SubscriptionBillingSummaryCardsProps = {
  statusFilter: SubscriptionStatusFilter;
  onStatusFilterChange: (next: SubscriptionStatusFilter) => void;
  className?: string;
};

type SummaryCardProps = {
  label: string;
  hint?: string;
  bucket: SubscriptionBillingSummaryBucket;
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
      {bucket.count} subscription{bucket.count === 1 ? "" : "s"}
      {hint ? ` · ${hint}` : ""}
    </span>
  </button>
);

export const SubscriptionBillingSummaryCards = ({
  statusFilter,
  onStatusFilterChange,
  className,
}: SubscriptionBillingSummaryCardsProps) => {
  const { data: subscriptions = [], isPending } = useGetList<ClientSubscription>(
    "client_subscriptions",
    {
      pagination: { page: 1, perPage: 1000 },
      sort: { field: "created_at", order: "DESC" },
      filter: {},
    },
    { staleTime: 30_000 },
  );

  const summary = useMemo(
    () => computeSubscriptionBillingSummary(subscriptions),
    [subscriptions],
  );

  if (isPending) {
    return (
      <div className={cn("grid gap-2 sm:grid-cols-3", className)}>
        <Skeleton className="h-[4.5rem] rounded-lg" />
        <Skeleton className="h-[4.5rem] rounded-lg" />
        <Skeleton className="h-[4.5rem] rounded-lg" />
      </div>
    );
  }

  return (
    <div className={cn("grid gap-2 sm:grid-cols-3", className)}>
      <SummaryCard
        label="Active MRR"
        hint="monthly equivalent"
        bucket={summary.activeMrr}
        active={statusFilter === "active"}
        onClick={() => onStatusFilterChange("active")}
      />
      <SummaryCard
        label="Pending setup"
        bucket={summary.pendingSetup}
        active={statusFilter === "pending_setup"}
        onClick={() => onStatusFilterChange("pending_setup")}
      />
      <SummaryCard
        label="Past due"
        bucket={summary.pastDue}
        active={statusFilter === "past_due"}
        tone="destructive"
        onClick={() => onStatusFilterChange("past_due")}
      />
    </div>
  );
};
