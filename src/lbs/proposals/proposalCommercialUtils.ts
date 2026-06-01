import type {
  BillingInterval,
  BillingType,
  InstallmentFrequency,
} from "@/lbs/proposals/proposalCommercialConstants";
import {
  DEFAULT_DEPOSIT_PERCENT,
  DEFAULT_VALIDITY_DAYS,
} from "@/lbs/proposals/proposalCommercialConstants";

export type ProposalLineDraft = {
  key: string;
  description: string;
  quantity: number;
  unit_price: number;
  billing_type: BillingType;
  billing_interval?: BillingInterval | null;
  package_id?: number | null;
  addon_id?: number | null;
  sort_order: number;
};

export type PaymentScheduleConfig = {
  installment_frequency: InstallmentFrequency;
  installment_count: number;
  deposit_due_date?: string | null;
  balance_start_date?: string | null;
};

export type ProposalTotals = {
  oneTimeTotal: number;
  recurringSubtotal: number;
  recurringLines: Array<{
    description: string;
    amount: number;
    interval: BillingInterval;
  }>;
  depositAmount: number;
  balanceAmount: number;
  grandTotalOneTime: number;
};

export const lineTotal = (quantity: number, unitPrice: number) =>
  Math.round(quantity * unitPrice * 100) / 100;

export const calculateProposalTotals = (
  lines: ProposalLineDraft[],
  depositPercent = DEFAULT_DEPOSIT_PERCENT,
): ProposalTotals => {
  const oneTimeLines = lines.filter((line) => line.billing_type === "one_time");
  const recurringLines = lines.filter(
    (line) => line.billing_type === "recurring",
  );

  const oneTimeTotal = oneTimeLines.reduce(
    (sum, line) => sum + lineTotal(line.quantity, line.unit_price),
    0,
  );

  const depositAmount =
    Math.round(oneTimeTotal * (depositPercent / 100) * 100) / 100;
  const balanceAmount = Math.round((oneTimeTotal - depositAmount) * 100) / 100;

  const recurringLineItems = recurringLines.map((line) => ({
    description: line.description,
    amount: lineTotal(line.quantity, line.unit_price),
    interval: line.billing_interval ?? "monthly",
  }));

  const recurringSubtotal = recurringLineItems.reduce(
    (sum, line) => sum + line.amount,
    0,
  );

  return {
    oneTimeTotal,
    recurringSubtotal,
    recurringLines: recurringLineItems,
    depositAmount,
    balanceAmount,
    grandTotalOneTime: oneTimeTotal,
  };
};

const addDays = (date: Date, days: number) => {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
};

const addMonths = (date: Date, months: number) => {
  const next = new Date(date);
  next.setMonth(next.getMonth() + months);
  return next;
};

const toDateKey = (date: Date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const nextDueDate = (
  start: Date,
  frequency: InstallmentFrequency,
  index: number,
) => {
  if (frequency === "weekly") return addDays(start, index * 7);
  if (frequency === "biweekly") return addDays(start, index * 14);
  if (frequency === "monthly") return addMonths(start, index);
  return addDays(start, index * 7);
};

export type GeneratedInstallment = {
  installment_number: number;
  label: string;
  due_date: string;
  amount: number;
  billing_type: BillingType;
};

export const generatePaymentInstallments = ({
  depositAmount,
  balanceAmount,
  config,
  startDate = new Date(),
}: {
  depositAmount: number;
  balanceAmount: number;
  config: PaymentScheduleConfig;
  startDate?: Date;
}): GeneratedInstallment[] => {
  const installments: GeneratedInstallment[] = [];
  const depositDue = config.deposit_due_date
    ? new Date(`${config.deposit_due_date}T12:00:00`)
    : startDate;

  if (depositAmount > 0) {
    installments.push({
      installment_number: 1,
      label: "Deposit (50%)",
      due_date: toDateKey(depositDue),
      amount: depositAmount,
      billing_type: "one_time",
    });
  }

  const count = Math.max(config.installment_count, 1);
  const balanceStart = config.balance_start_date
    ? new Date(`${config.balance_start_date}T12:00:00`)
    : addDays(depositDue, 7);

  const perInstallment =
    count > 0 ? Math.round((balanceAmount / count) * 100) / 100 : balanceAmount;

  let allocated = 0;
  for (let index = 0; index < count; index += 1) {
    const isLast = index === count - 1;
    const amount = isLast
      ? Math.round((balanceAmount - allocated) * 100) / 100
      : perInstallment;
    allocated += amount;

    installments.push({
      installment_number: installments.length + 1,
      label:
        count === 1 ? "Final balance" : `Installment ${index + 1} of ${count}`,
      due_date: toDateKey(
        nextDueDate(balanceStart, config.installment_frequency, index),
      ),
      amount,
      billing_type: "one_time",
    });
  }

  return installments;
};

export const computeValidUntil = (
  validityDays = DEFAULT_VALIDITY_DAYS,
  fromDate = new Date(),
) => toDateKey(addDays(fromDate, validityDays));

export const formatProposalNumber = (orgId: number, proposalId: number) => {
  const year = new Date().getFullYear();
  return `PROP-${year}-${String(proposalId).padStart(4, "0")}`;
};

export const recurringSummaryFromLines = (lines: ProposalLineDraft[]) =>
  lines
    .filter((line) => line.billing_type === "recurring")
    .map((line) => ({
      description: line.description,
      amount: lineTotal(line.quantity, line.unit_price),
      interval: line.billing_interval ?? "monthly",
    }));
