import type {
  DealChangeOrder,
  DealClientPayment,
  DealExpense,
} from "@/components/atomic-crm/types";
import type { LbsDeal } from "@/modules/types";

const toNumber = (value: unknown) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

export const getCollectedPaymentsTotal = (payments: DealClientPayment[]) =>
  payments
    .filter(
      (payment) =>
        payment.status === "cleared" || payment.status === "deposited",
    )
    .reduce((sum, payment) => sum + toNumber(payment.amount), 0);

export const getApprovedChangeOrdersTotal = (changeOrders: DealChangeOrder[]) =>
  changeOrders
    .filter((entry) => entry.status === "approved")
    .reduce((sum, entry) => sum + toNumber(entry.amount), 0);

export const getExpensesTotal = (expenses: DealExpense[]) =>
  expenses.reduce((sum, entry) => sum + toNumber(entry.amount), 0);

export const getProjectBaseValue = (record: LbsDeal) =>
  toNumber(record.original_project_value) ||
  toNumber(record.estimated_value) ||
  toNumber(record.amount);

export const getProjectCurrentValue = (
  record: LbsDeal,
  approvedChangeOrdersTotal: number,
) => {
  const fromRecord = toNumber(record.current_project_value);
  if (fromRecord > 0) return fromRecord;
  return getProjectBaseValue(record) + approvedChangeOrdersTotal;
};

export type ProjectProfitSummary = {
  projectValue: number;
  changeOrdersTotal: number;
  currentValue: number;
  collected: number;
  pending: number;
  expenses: number;
  estimatedProfit: number;
  marginPercent: number | null;
};

export const buildProjectProfitSummary = (
  record: LbsDeal,
  expenses: DealExpense[],
  changeOrders: DealChangeOrder[],
  payments: DealClientPayment[],
): ProjectProfitSummary => {
  const projectValue = getProjectBaseValue(record);
  const changeOrdersTotal = getApprovedChangeOrdersTotal(changeOrders);
  const currentValue = getProjectCurrentValue(record, changeOrdersTotal);
  const collected = getCollectedPaymentsTotal(payments);
  const pending = Math.max(0, currentValue - collected);
  const expenseTotal = getExpensesTotal(expenses);
  const estimatedProfit = collected - expenseTotal;
  const marginPercent =
    collected > 0 ? (estimatedProfit / collected) * 100 : null;

  return {
    projectValue,
    changeOrdersTotal,
    currentValue,
    collected,
    pending,
    expenses: expenseTotal,
    estimatedProfit,
    marginPercent,
  };
};
