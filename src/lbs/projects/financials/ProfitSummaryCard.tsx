import { useMemo } from "react";
import { useGetList } from "ra-core";
import type {
  DealChangeOrder,
  DealClientPayment,
  DealCommission,
  DealExpense,
} from "@/components/atomic-crm/types";
import { MoneyText } from "@/lib/permissions/MoneyText";
import type { LbsDeal } from "@/lbs/types";
import { buildProjectProfitSummary } from "./projectFinancialMetrics";

const SummaryRow = ({
  label,
  value,
  emphasize,
  className,
}: {
  label: string;
  value: number;
  emphasize?: boolean;
  className?: string;
}) => (
  <div className={`flex items-center justify-between gap-3 text-sm ${className ?? ""}`}>
    <span className="text-muted-foreground">{label}</span>
    <span className={emphasize ? "font-semibold" : "font-medium"}>
      <MoneyText value={value} />
    </span>
  </div>
);

export const ProfitSummaryCard = ({ record }: { record: LbsDeal }) => {
  const { data: expenses = [] } = useGetList<DealExpense>(
    "deal_expenses",
    {
      filter: { "deal_id@eq": record.id },
      pagination: { page: 1, perPage: 500 },
      sort: { field: "created_at", order: "DESC" },
    },
    { staleTime: 30_000 },
  );
  const { data: changeOrders = [] } = useGetList<DealChangeOrder>(
    "deal_change_orders",
    {
      filter: { "deal_id@eq": record.id },
      pagination: { page: 1, perPage: 500 },
      sort: { field: "created_at", order: "DESC" },
    },
    { staleTime: 30_000 },
  );
  const { data: commissions = [] } = useGetList<DealCommission>(
    "deal_commissions",
    {
      filter: { "deal_id@eq": record.id },
      pagination: { page: 1, perPage: 500 },
      sort: { field: "created_at", order: "DESC" },
    },
    { staleTime: 30_000 },
  );
  const { data: payments = [] } = useGetList<DealClientPayment>(
    "deal_client_payments",
    {
      filter: { "deal_id@eq": record.id },
      pagination: { page: 1, perPage: 500 },
      sort: { field: "created_at", order: "DESC" },
    },
    { staleTime: 30_000 },
  );

  const summary = useMemo(
    () =>
      buildProjectProfitSummary(
        record,
        expenses,
        changeOrders,
        commissions,
        payments,
      ),
    [record, expenses, changeOrders, commissions, payments],
  );

  return (
    <div className="rounded-lg border p-4">
      <h3 className="text-base font-semibold">Profit summary</h3>
      <div className="mt-4 space-y-2">
        <SummaryRow label="Project value" value={summary.projectValue} />
        <SummaryRow
          label="Change orders"
          value={summary.changeOrdersTotal}
          className="text-emerald-700 dark:text-emerald-400"
        />
        <SummaryRow label="Current value" value={summary.currentValue} emphasize />
        <div className="my-2 border-t" />
        <SummaryRow label="Collected" value={summary.collected} />
        <SummaryRow label="Pending" value={summary.pending} />
        <div className="my-2 border-t" />
        <SummaryRow
          label="Expenses"
          value={-summary.expenses}
          className="text-destructive"
        />
        <SummaryRow
          label="Commissions"
          value={-summary.commissions}
          className="text-destructive"
        />
        <div className="my-2 border-t" />
        <SummaryRow
          label="Estimated profit"
          value={summary.estimatedProfit}
          emphasize
        />
        <div className="flex items-center justify-between gap-3 text-sm">
          <span className="text-muted-foreground">Margin</span>
          <span className="font-semibold">
            {summary.marginPercent != null ? (
              `${summary.marginPercent.toFixed(0)}%`
            ) : (
              <MoneyText value={null} />
            )}
          </span>
        </div>
      </div>
    </div>
  );
};
