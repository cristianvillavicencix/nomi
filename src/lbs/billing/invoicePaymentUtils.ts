import {
  generateInvoiceBalanceCharges,
  parseInvoiceRemainderSchedule,
  type InvoiceRemainderScheduleConfig,
} from "@/lbs/billing/invoiceRemainderSchedule";

export type InvoicePaymentCollectionMode = "full" | "deposit_auto";

export const invoicePaymentModeFromRecord = (invoice: {
  upfront_percent?: number | null;
  auto_charge_remainder?: boolean | null;
}): InvoicePaymentCollectionMode => {
  const percent = Number(invoice.upfront_percent ?? 100);
  if (percent < 100 && invoice.auto_charge_remainder) {
    return "deposit_auto";
  }
  if (percent < 100) {
    return "deposit_auto";
  }
  return "full";
};

export const upfrontPercentFromMode = (
  mode: InvoicePaymentCollectionMode,
  depositPercent: number,
) => (mode === "full" ? 100 : Math.min(Math.max(depositPercent, 1), 99));

export const computeInvoiceUpfrontAmount = (
  total: number,
  upfrontPercent: number,
  amountPaid = 0,
) => {
  const target = Math.round(total * (upfrontPercent / 100) * 100) / 100;
  const remaining = Math.max(target - amountPaid, 0);
  return Math.min(remaining, Math.max(total - amountPaid, 0));
};

export const computeInvoiceBalanceDue = (total: number, amountPaid = 0) =>
  Math.max(Math.round((total - amountPaid) * 100) / 100, 0);

export type InvoicePaymentScheduleTiming = "now" | "scheduled" | "paid";

export type InvoicePaymentScheduleRow = {
  key: string;
  label: string;
  amount: number;
  /** null = due today at checkout */
  dueDate: string | null;
  timing: InvoicePaymentScheduleTiming;
  autoDebit: boolean;
};

export const buildInvoicePaymentSchedule = ({
  total,
  amountPaid = 0,
  upfrontPercent = 100,
  autoChargeRemainder = false,
  saveCard = false,
  dueDate = null,
  issueDate = null,
  remainderSchedule = null,
}: {
  total: number;
  amountPaid?: number;
  upfrontPercent?: number;
  autoChargeRemainder?: boolean;
  saveCard?: boolean;
  dueDate?: string | null;
  issueDate?: string | null;
  remainderSchedule?: InvoiceRemainderScheduleConfig | null;
}): InvoicePaymentScheduleRow[] => {
  const paid = Math.max(Number(amountPaid) || 0, 0);
  const balance = computeInvoiceBalanceDue(total, paid);

  if (balance <= 0.01) {
    return [
      {
        key: "paid",
        label: "Paid in full",
        amount: total,
        dueDate: null,
        timing: "paid",
        autoDebit: false,
      },
    ];
  }

  const percent = Math.min(Math.max(Number(upfrontPercent) || 100, 1), 100);
  if (percent >= 100) {
    return [
      {
        key: "full",
        label: "Amount due",
        amount: balance,
        dueDate: null,
        timing: "now",
        autoDebit: false,
      },
    ];
  }

  const depositTarget =
    Math.round(total * (percent / 100) * 100) / 100;
  const remainderTarget =
    Math.max(Math.round((total - depositTarget) * 100) / 100, 0);
  const depositDue =
    Math.max(Math.round((depositTarget - paid) * 100) / 100, 0);
  const depositPaid = paid >= depositTarget - 0.01;
  const autoDebit = Boolean(autoChargeRemainder && saveCard);
  const rows: InvoicePaymentScheduleRow[] = [];

  if (depositPaid) {
    rows.push({
      key: "deposit",
      label: `Deposit (${percent}%)`,
      amount: depositTarget,
      dueDate: null,
      timing: "paid",
      autoDebit: false,
    });
  } else if (depositDue > 0.01) {
    rows.push({
      key: "deposit",
      label: `Deposit (${percent}%)`,
      amount: depositDue,
      dueDate: null,
      timing: "now",
      autoDebit: false,
    });
  }

  const remainderAmount = depositPaid ? balance : remainderTarget;
  if (remainderAmount > 0.01) {
    const scheduleConfig = remainderSchedule
      ? remainderSchedule
      : parseInvoiceRemainderSchedule(null, dueDate ?? "");

    const balanceCharges = generateInvoiceBalanceCharges({
      balanceAmount: remainderAmount,
      config: scheduleConfig,
      invoiceDueDate: dueDate ?? new Date().toISOString().slice(0, 10),
      issueDate: issueDate ?? new Date().toISOString().slice(0, 10),
    });

    if (balanceCharges.length > 0) {
      for (const charge of balanceCharges) {
        rows.push({
          key: `remainder-${charge.installment_number}`,
          label: autoDebit
            ? `${charge.label} (auto-debit)`
            : charge.label,
          amount: charge.amount,
          dueDate: charge.due_date,
          timing: depositPaid && !autoDebit ? "now" : "scheduled",
          autoDebit,
        });
      }
    } else {
      rows.push({
        key: "remainder",
        label: autoDebit ? "Balance (auto-debit)" : "Balance due",
        amount: remainderAmount,
        dueDate,
        timing: depositPaid && !autoDebit ? "now" : "scheduled",
        autoDebit,
      });
    }
  }

  return rows;
};

export const invoiceHasDepositPaymentPlan = (invoice: {
  upfront_percent?: number | null;
  auto_charge_remainder?: boolean | null;
}) => Number(invoice.upfront_percent ?? 100) < 100;

export type InvoiceAmortizationRow = {
  paymentNumber: number;
  description: string;
  dueDate: string | null;
  amount: number;
  balanceAfter: number;
  timing: InvoicePaymentScheduleTiming;
  autoDebit: boolean;
};

const amortizationDescription = (
  row: InvoicePaymentScheduleRow,
  upfrontPercent: number,
  remainderIndex: number,
  remainderCount: number,
) => {
  if (row.key === "full") {
    return "Full payment";
  }
  if (row.key === "deposit") {
    return `Deposit (${upfrontPercent}%)`;
  }
  if (row.key.startsWith("remainder")) {
    if (remainderCount <= 1) {
      return "Final balance";
    }
    return `Installment ${remainderIndex} of ${remainderCount}`;
  }
  return row.label.replace(/\s*\(auto-debit\)/i, "");
};

export const buildInvoiceAmortizationSchedule = (params: {
  total: number;
  amountPaid?: number;
  upfrontPercent?: number;
  autoChargeRemainder?: boolean;
  saveCard?: boolean;
  dueDate?: string | null;
  issueDate?: string | null;
  remainderSchedule?: InvoiceRemainderScheduleConfig | null;
}): InvoiceAmortizationRow[] => {
  const total = Number(params.total) || 0;
  const upfrontPercent = Number(params.upfrontPercent ?? 100);
  const scheduleRows = buildInvoicePaymentSchedule(params);
  const activeRows = scheduleRows.filter((row) => row.timing !== "paid");
  if (!activeRows.length) return [];

  let balance = computeInvoiceBalanceDue(total, params.amountPaid ?? 0);
  const remainderCount = activeRows.filter((row) =>
    row.key.startsWith("remainder"),
  ).length;
  let remainderIndex = 0;

  return activeRows.map((row, index) => {
    const paymentNumber = index + 1;
    if (row.key.startsWith("remainder")) {
      remainderIndex += 1;
    }
    const balanceAfter = Math.max(
      Math.round((balance - row.amount) * 100) / 100,
      0,
    );
    const entry: InvoiceAmortizationRow = {
      paymentNumber,
      description: amortizationDescription(
        row,
        upfrontPercent,
        remainderIndex,
        remainderCount,
      ),
      dueDate: row.timing === "now" ? null : row.dueDate,
      amount: row.amount,
      balanceAfter,
      timing: row.timing,
      autoDebit: row.autoDebit,
    };
    balance = balanceAfter;
    return entry;
  });
};
