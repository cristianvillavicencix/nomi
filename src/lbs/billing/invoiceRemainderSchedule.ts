import type { InstallmentFrequency } from "@/lbs/proposals/proposalCommercialConstants";

export type InvoiceRemainderTiming =
  | "invoice_due_date"
  | "project_end"
  | "weekly"
  | "biweekly"
  | "monthly";

export type InvoiceRemainderScheduleConfig = {
  timing: InvoiceRemainderTiming;
  installment_count: number;
  balance_start_date?: string | null;
  project_end_date?: string | null;
};

export const INVOICE_REMAINDER_TIMING_OPTIONS: {
  value: InvoiceRemainderTiming;
  label: string;
  description: string;
}[] = [
  {
    value: "invoice_due_date",
    label: "On invoice due date",
    description: "Charge the full remaining balance on the invoice due date.",
  },
  {
    value: "project_end",
    label: "When project ends",
    description: "Charge the balance on a project completion date you choose.",
  },
  {
    value: "weekly",
    label: "Weekly installments",
    description: "Split the balance into equal weekly automatic charges.",
  },
  {
    value: "biweekly",
    label: "Biweekly installments",
    description: "Split the balance into equal charges every two weeks.",
  },
  {
    value: "monthly",
    label: "Monthly installments",
    description: "Split the balance into equal monthly automatic charges.",
  },
];

export const defaultInvoiceRemainderSchedule = (
  invoiceDueDate: string,
): InvoiceRemainderScheduleConfig => ({
  timing: "invoice_due_date",
  installment_count: 1,
  balance_start_date: null,
  project_end_date: invoiceDueDate,
});

export const parseInvoiceRemainderSchedule = (
  raw: unknown,
  invoiceDueDate: string,
): InvoiceRemainderScheduleConfig => {
  if (!raw || typeof raw !== "object") {
    return defaultInvoiceRemainderSchedule(invoiceDueDate);
  }
  const row = raw as Record<string, unknown>;
  const timing = row.timing as InvoiceRemainderTiming;
  const validTiming = INVOICE_REMAINDER_TIMING_OPTIONS.some(
    (entry) => entry.value === timing,
  )
    ? timing
    : "invoice_due_date";

  return {
    timing: validTiming,
    installment_count: Math.min(
      52,
      Math.max(1, Number(row.installment_count) || 1),
    ),
    balance_start_date:
      typeof row.balance_start_date === "string"
        ? row.balance_start_date
        : null,
    project_end_date:
      typeof row.project_end_date === "string"
        ? row.project_end_date
        : invoiceDueDate,
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

export type InvoiceBalanceChargeRow = {
  installment_number: number;
  label: string;
  due_date: string;
  amount: number;
};

export const generateInvoiceBalanceCharges = ({
  balanceAmount,
  config,
  invoiceDueDate,
  issueDate,
}: {
  balanceAmount: number;
  config: InvoiceRemainderScheduleConfig;
  invoiceDueDate: string;
  issueDate: string;
}): InvoiceBalanceChargeRow[] => {
  if (balanceAmount <= 0.01) return [];

  const timing = config.timing;

  if (timing === "invoice_due_date") {
    return [
      {
        installment_number: 1,
        label: "Balance due",
        due_date: invoiceDueDate,
        amount: balanceAmount,
      },
    ];
  }

  if (timing === "project_end") {
    const due =
      config.project_end_date?.trim() || invoiceDueDate;
    return [
      {
        installment_number: 1,
        label: "Balance at project end",
        due_date: due,
        amount: balanceAmount,
      },
    ];
  }

  const count = Math.max(config.installment_count, 1);
  const frequency = timing as InstallmentFrequency;
  const balanceStart = config.balance_start_date
    ? new Date(`${config.balance_start_date}T12:00:00`)
    : addDays(new Date(`${issueDate}T12:00:00`), 7);

  const perInstallment =
    count > 0
      ? Math.round((balanceAmount / count) * 100) / 100
      : balanceAmount;

  const rows: InvoiceBalanceChargeRow[] = [];
  let allocated = 0;

  for (let index = 0; index < count; index += 1) {
    const isLast = index === count - 1;
    const amount = isLast
      ? Math.round((balanceAmount - allocated) * 100) / 100
      : perInstallment;
    allocated += amount;

    rows.push({
      installment_number: index + 1,
      label:
        count === 1
          ? "Balance"
          : `Installment ${index + 1} of ${count}`,
      due_date: toDateKey(
        nextDueDate(balanceStart, frequency, index),
      ),
      amount,
    });
  }

  return rows;
};

export const remainderTimingIsRecurring = (timing: InvoiceRemainderTiming) =>
  timing === "weekly" || timing === "biweekly" || timing === "monthly";

export const describeInvoiceRemainderTiming = (
  config: InvoiceRemainderScheduleConfig,
) => {
  const option = INVOICE_REMAINDER_TIMING_OPTIONS.find(
    (entry) => entry.value === config.timing,
  );
  if (!remainderTimingIsRecurring(config.timing)) {
    return option?.label ?? "On invoice due date";
  }
  const freq =
    config.timing === "weekly"
      ? "weekly"
      : config.timing === "biweekly"
        ? "biweekly"
        : "monthly";
  return `${config.installment_count} ${freq} installment${config.installment_count === 1 ? "" : "s"}`;
};

export const describeInvoiceOnlinePaymentSummary = ({
  paymentMode,
  depositPercent,
  total,
  remainderSchedule,
}: {
  paymentMode: "full" | "deposit_auto";
  depositPercent: number;
  total: number;
  remainderSchedule: InvoiceRemainderScheduleConfig;
}) => {
  if (paymentMode === "full") {
    return "Client pays the full balance in one checkout.";
  }
  const deposit =
    Math.round(total * (Math.min(Math.max(depositPercent, 1), 99) / 100) * 100) /
    100;
  const balance = Math.max(Math.round((total - deposit) * 100) / 100, 0);
  const timing = describeInvoiceRemainderTiming(remainderSchedule);
  return `${depositPercent}% deposit now (${formatUsd(deposit)}) · Balance ${formatUsd(balance)} — ${timing} (auto-debit)`;
};

const formatUsd = (value: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(
    value,
  );
