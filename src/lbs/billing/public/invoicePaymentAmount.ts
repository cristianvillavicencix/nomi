import type { InvoiceAmortizationRow } from "@/lbs/billing/invoicePaymentUtils";

const roundMoney = (value: number) => Math.round(value * 100) / 100;

export const computeInvoiceDepositTarget = (
  total: number,
  upfrontPercent: number,
) =>
  Math.round(
    total * (Math.min(Math.max(Number(upfrontPercent) || 100, 1), 100) / 100) *
      100,
  ) / 100;

export const isInvoiceDepositPaid = (
  total: number,
  upfrontPercent: number,
  amountPaid: number,
) =>
  amountPaid >= computeInvoiceDepositTarget(total, upfrontPercent) - 0.01;

/** Scheduled remainder installments — never the upfront deposit row. */
export const filterRemainderInstallmentRows = (
  amortizationRows: InvoiceAmortizationRow[],
) =>
  amortizationRows.filter((row) => {
    if (row.timing === "paid") return false;
    if (/^Deposit/i.test(row.description)) return false;
    return true;
  });

/** Default checkout selection: deposit only first; then the next due installment. */
export const resolveDefaultSelectedInstallmentNumbers = (
  upcomingInstallments: InvoiceAmortizationRow[],
  depositPaid: boolean,
) => {
  if (!depositPaid || upcomingInstallments.length === 0) return [];

  const dueToday = upcomingInstallments.find((row) => row.timing === "now");
  if (dueToday) return [dueToday.paymentNumber];

  const sorted = [...upcomingInstallments].sort((a, b) => {
    const left = a.dueDate ?? "9999-12-31";
    const right = b.dueDate ?? "9999-12-31";
    return left.localeCompare(right);
  });
  return sorted[0] ? [sorted[0].paymentNumber] : [];
};

export const findNextDueInstallment = (
  upcomingInstallments: InvoiceAmortizationRow[],
) => {
  const [nextPaymentNumber] = resolveDefaultSelectedInstallmentNumbers(
    upcomingInstallments,
    true,
  );
  if (!nextPaymentNumber) return null;
  return (
    upcomingInstallments.find((row) => row.paymentNumber === nextPaymentNumber) ??
    null
  );
};

export const mapToRemainderInstallmentNumbers = (
  amortizationRows: InvoiceAmortizationRow[],
  selectedPaymentNumbers: number[],
) =>
  selectedPaymentNumbers
    .map((paymentNumber) => {
      const row = amortizationRows.find(
        (entry) => entry.paymentNumber === paymentNumber,
      );
      return row?.remainderInstallmentNumber ?? null;
    })
    .filter((value): value is number => value != null);

export const resolveInvoicePaymentAmount = ({
  selectedInstallmentNumbers,
  balanceDue,
  depositDue,
  upcomingInstallments,
}: {
  selectedInstallmentNumbers: number[];
  balanceDue: number;
  depositDue: number;
  upcomingInstallments: InvoiceAmortizationRow[];
}) => {
  const max = roundMoney(balanceDue);
  const selectedTotal = upcomingInstallments
    .filter((row) => selectedInstallmentNumbers.includes(row.paymentNumber))
    .reduce((sum, row) => sum + row.amount, 0);

  return Math.min(roundMoney(depositDue + selectedTotal), max);
};

export const resolveEffectiveInstallmentSelection = (
  selectedInstallmentNumbers: number[],
  upcomingInstallments: InvoiceAmortizationRow[],
  depositPaid: boolean,
) =>
  selectedInstallmentNumbers.length > 0
    ? selectedInstallmentNumbers
    : resolveDefaultSelectedInstallmentNumbers(upcomingInstallments, depositPaid);

export const isValidInvoicePaymentAmount = ({
  amount,
  balanceDue,
  depositPaid,
  hasInstallmentPlan,
  effectiveInstallmentCount,
}: {
  amount: number;
  balanceDue: number;
  depositPaid: boolean;
  hasInstallmentPlan: boolean;
  effectiveInstallmentCount: number;
}) => {
  if (amount < 0.01 || amount > roundMoney(balanceDue) + 0.001) {
    return false;
  }
  if (!depositPaid) {
    return true;
  }
  if (hasInstallmentPlan && effectiveInstallmentCount < 1) {
    return false;
  }
  return true;
};

export const invoicePaymentConsentLabelForAmount = ({
  chargeAmount,
  balanceDue,
  depositPaid,
  autoChargeRemainder,
  saveCardForFutureCharges,
  selectedInstallmentCount,
  hasUpcomingAutoInstallments,
}: {
  chargeAmount: number;
  balanceDue: number;
  depositPaid?: boolean;
  autoChargeRemainder?: boolean;
  saveCardForFutureCharges?: boolean;
  selectedInstallmentCount?: number;
  hasUpcomingAutoInstallments?: boolean;
}) => {
  const payingFull = chargeAmount >= balanceDue - 0.01;
  const autoCharge = Boolean(autoChargeRemainder && saveCardForFutureCharges);
  const extraCount = selectedInstallmentCount ?? 0;

  if (payingFull) {
    return "I authorize this payment to pay the invoice in full.";
  }

  if (autoCharge && hasUpcomingAutoInstallments) {
    if (!depositPaid && extraCount === 0) {
      return "I authorize today's payment, and I authorize Latino Business Support to charge the remaining installments to this card on their scheduled dates.";
    }
    if (depositPaid || extraCount > 0) {
      return "I authorize today's payment, and I authorize Latino Business Support to charge the remaining installments to this card on their scheduled dates.";
    }
  }

  if (extraCount > 0) {
    return "I authorize today's payment.";
  }

  return "I authorize today's payment.";
};
