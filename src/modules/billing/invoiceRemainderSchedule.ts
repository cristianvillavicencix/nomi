import type { InstallmentFrequency } from "@/modules/proposals/proposalCommercialConstants";

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
  /** Remainder installment numbers (1-based) already paid early or via auto-debit. */
  paid_installment_numbers?: number[];
  /** Rescheduled due dates for unpaid remainder installments (same order). */
  installment_due_dates?: string[];
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
    paid_installment_numbers: Array.isArray(row.paid_installment_numbers)
      ? row.paid_installment_numbers
          .map((value) => Number(value))
          .filter((value) => Number.isFinite(value) && value > 0)
      : undefined,
    installment_due_dates: Array.isArray(row.installment_due_dates)
      ? row.installment_due_dates.filter(
          (value): value is string => typeof value === "string" && Boolean(value.trim()),
        )
      : undefined,
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

/** Base schedule before early-pay shifts — ignores paid/rescheduled state. */
export const generateOriginalInvoiceBalanceCharges = (params: {
  balanceAmount: number;
  config: InvoiceRemainderScheduleConfig;
  invoiceDueDate: string;
  issueDate: string;
}) =>
  generateInvoiceBalanceCharges({
    ...params,
    config: {
      ...params.config,
      paid_installment_numbers: undefined,
      installment_due_dates: undefined,
    },
  });

export const applyRemainderScheduleToCharges = (
  allCharges: InvoiceBalanceChargeRow[],
  config: InvoiceRemainderScheduleConfig,
) => {
  const paidNumbers = new Set(config.paid_installment_numbers ?? []);
  if (!paidNumbers.size && !config.installment_due_dates?.length) {
    return allCharges;
  }

  const unpaid = allCharges
    .filter((row) => !paidNumbers.has(row.installment_number))
    .sort((a, b) => a.installment_number - b.installment_number);
  const originalSlots = allCharges.map((row) => row.due_date);
  const rescheduled =
    config.installment_due_dates?.length === unpaid.length
      ? config.installment_due_dates
      : originalSlots.slice(0, unpaid.length);

  return unpaid.map((row, index) => ({
    ...row,
    due_date: rescheduled[index] ?? row.due_date,
  }));
};

/**
 * When the client pays remainder installment(s) early, shift unpaid dates
 * forward into the vacated schedule slots (weekly/biweekly/monthly cadence preserved).
 */
export const rescheduleRemainderAfterEarlyPayments = ({
  config,
  allCharges,
  newlyPaidInstallmentNumbers,
}: {
  config: InvoiceRemainderScheduleConfig;
  allCharges: InvoiceBalanceChargeRow[];
  newlyPaidInstallmentNumbers: number[];
}) => {
  const paid = [
    ...new Set([
      ...(config.paid_installment_numbers ?? []),
      ...newlyPaidInstallmentNumbers.filter((value) => value > 0),
    ]),
  ];
  const unpaid = allCharges
    .filter((row) => !paid.includes(row.installment_number))
    .sort((a, b) => a.installment_number - b.installment_number);
  const originalSlots = allCharges.map((row) => row.due_date);

  return {
    ...config,
    paid_installment_numbers: paid,
    installment_due_dates: originalSlots.slice(0, unpaid.length),
  };
};

/** Preview due dates after paying selected installment(s) early (UI + validation). */
export const previewRemainderScheduleAfterPayments = ({
  total,
  upfrontPercent,
  config,
  invoiceDueDate,
  issueDate,
  payingInstallmentNumbers,
}: {
  total: number;
  upfrontPercent: number;
  config: InvoiceRemainderScheduleConfig;
  invoiceDueDate: string;
  issueDate: string;
  payingInstallmentNumbers: number[];
}) => {
  const depositTarget =
    Math.round(total * (Math.min(Math.max(upfrontPercent, 1), 99) / 100) * 100) /
    100;
  const balanceAmount = Math.max(Math.round((total - depositTarget) * 100) / 100, 0);
  const originalCharges = generateOriginalInvoiceBalanceCharges({
    balanceAmount,
    config,
    invoiceDueDate,
    issueDate,
  });

  if (!payingInstallmentNumbers.length) {
    return applyRemainderScheduleToCharges(originalCharges, config);
  }

  const previewConfig = rescheduleRemainderAfterEarlyPayments({
    config,
    allCharges: originalCharges,
    newlyPaidInstallmentNumbers: payingInstallmentNumbers,
  });

  return applyRemainderScheduleToCharges(originalCharges, previewConfig);
};

/** Unpaid remainder rows due on or before asOfDate (YYYY-MM-DD). */
export const getUnpaidRemainderChargesDueBy = ({
  total,
  upfrontPercent,
  config,
  invoiceDueDate,
  issueDate,
  asOfDate,
}: {
  total: number;
  upfrontPercent: number;
  config: InvoiceRemainderScheduleConfig;
  invoiceDueDate: string;
  issueDate: string;
  asOfDate: string;
}) => {
  const depositTarget =
    Math.round(total * (Math.min(Math.max(upfrontPercent, 1), 99) / 100) * 100) /
    100;
  const balanceAmount = Math.max(Math.round((total - depositTarget) * 100) / 100, 0);
  const originalCharges = generateOriginalInvoiceBalanceCharges({
    balanceAmount,
    config,
    invoiceDueDate,
    issueDate,
  });
  const scheduled = applyRemainderScheduleToCharges(originalCharges, config);
  const paid = new Set(config.paid_installment_numbers ?? []);
  return scheduled
    .filter(
      (row) => !paid.has(row.installment_number) && row.due_date <= asOfDate,
    )
    .sort((a, b) => a.installment_number - b.installment_number);
};

export const formatUsd = (value: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(
    value,
  );

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
