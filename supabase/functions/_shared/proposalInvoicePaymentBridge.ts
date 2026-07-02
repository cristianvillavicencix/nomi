import {
  defaultInvoiceRemainderSchedule,
  parseInvoiceRemainderSchedule,
  type InvoiceRemainderScheduleConfig,
} from "./invoiceRemainderSchedule.ts";

export type ProposalOnlinePaymentSetup = {
  paymentMode: "full" | "deposit_auto";
  depositPercent: number;
  saveCard: boolean;
  remainderSchedule: InvoiceRemainderScheduleConfig;
};

export type ClientInvoicePaymentFields = {
  save_card_for_future_charges: boolean;
  upfront_percent: number;
  auto_charge_remainder: boolean;
  remainder_schedule: InvoiceRemainderScheduleConfig | null;
};

type LegacyPaymentScheduleConfig = {
  installment_frequency?: string;
  installment_count?: number;
  deposit_due_date?: string | null;
  balance_start_date?: string | null;
};

export const parseProposalOnlinePaymentSetup = ({
  paymentScheduleConfig,
  depositPercent,
  anchorDate,
}: {
  paymentScheduleConfig: unknown;
  depositPercent: number;
  anchorDate: string;
}): ProposalOnlinePaymentSetup => {
  if (paymentScheduleConfig && typeof paymentScheduleConfig === "object") {
    const row = paymentScheduleConfig as Record<string, unknown>;
    if (row.paymentMode === "full" || row.paymentMode === "deposit_auto") {
      return {
        paymentMode: row.paymentMode,
        depositPercent:
          row.paymentMode === "full"
            ? 100
            : Math.min(
                99,
                Math.max(1, Number(row.depositPercent) || depositPercent),
              ),
        saveCard: Boolean(row.saveCard),
        remainderSchedule: parseInvoiceRemainderSchedule(
          row.remainderSchedule,
          anchorDate,
        ),
      };
    }
  }

  const legacy = paymentScheduleConfig as
    | LegacyPaymentScheduleConfig
    | undefined;
  if (depositPercent >= 100) {
    return {
      paymentMode: "full",
      depositPercent: 100,
      saveCard: false,
      remainderSchedule: defaultInvoiceRemainderSchedule(anchorDate),
    };
  }

  const frequency = legacy?.installment_frequency ?? "weekly";
  const count = legacy?.installment_count ?? 4;
  const recurringFrequency =
    frequency === "weekly" ||
    frequency === "biweekly" ||
    frequency === "monthly"
      ? frequency
      : "monthly";

  if (count <= 1 && frequency !== "weekly" && frequency !== "biweekly") {
    return {
      paymentMode: "deposit_auto",
      depositPercent,
      saveCard: true,
      remainderSchedule: {
        timing: "invoice_due_date",
        installment_count: 1,
        balance_start_date: legacy?.balance_start_date ?? anchorDate,
        project_end_date: legacy?.balance_start_date ?? anchorDate,
      },
    };
  }

  return {
    paymentMode: "deposit_auto",
    depositPercent,
    saveCard: true,
    remainderSchedule: {
      timing: recurringFrequency,
      installment_count: count,
      balance_start_date: legacy?.balance_start_date ?? null,
      project_end_date: legacy?.balance_start_date ?? anchorDate,
    },
  };
};

export const isProposalDepositInstallment = (installment: {
  label: string;
  installment_number?: number | null;
}) =>
  /deposit/i.test(installment.label) ||
  (installment.installment_number === 1 && /deposit/i.test(installment.label));

/** Maps proposal online payment settings to a single issued installment invoice. */
export const clientInvoicePaymentFromProposalInstallment = (
  setup: ProposalOnlinePaymentSetup,
  installment: {
    label: string;
    installment_number?: number | null;
    due_date: string;
  },
): ClientInvoicePaymentFields => {
  if (setup.paymentMode === "full") {
    return {
      upfront_percent: 100,
      save_card_for_future_charges: setup.saveCard,
      auto_charge_remainder: false,
      remainder_schedule: null,
    };
  }

  if (isProposalDepositInstallment(installment)) {
    return {
      upfront_percent: 100,
      save_card_for_future_charges: true,
      auto_charge_remainder: false,
      remainder_schedule: null,
    };
  }

  return {
    upfront_percent: 100,
    save_card_for_future_charges: true,
    auto_charge_remainder: true,
    remainder_schedule: {
      timing: "invoice_due_date",
      installment_count: 1,
      balance_start_date: null,
      project_end_date: installment.due_date,
    },
  };
};

/** Whole-proposal invoice (no installment row) — mirrors proposal online payment on one invoice. */
export const clientInvoicePaymentFromProposalSetup = (
  setup: ProposalOnlinePaymentSetup,
  dueDate: string,
): ClientInvoicePaymentFields => {
  if (setup.paymentMode === "full") {
    return {
      upfront_percent: 100,
      save_card_for_future_charges: setup.saveCard,
      auto_charge_remainder: false,
      remainder_schedule: null,
    };
  }

  return {
    upfront_percent: Math.min(Math.max(setup.depositPercent, 1), 99),
    save_card_for_future_charges: true,
    auto_charge_remainder: true,
    remainder_schedule: {
      ...setup.remainderSchedule,
      project_end_date: setup.remainderSchedule.project_end_date ?? dueDate,
    },
  };
};
