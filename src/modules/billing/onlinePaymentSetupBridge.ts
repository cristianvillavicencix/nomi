import type { InvoicePaymentCollectionMode } from "@/modules/billing/invoicePaymentUtils";
import {
  defaultInvoiceRemainderSchedule,
  generateInvoiceBalanceCharges,
  parseInvoiceRemainderSchedule,
  type InvoiceRemainderScheduleConfig,
} from "@/modules/billing/invoiceRemainderSchedule";
import { DEFAULT_DEPOSIT_PERCENT } from "@/modules/proposals/proposalCommercialConstants";
import type { InstallmentFrequency } from "@/modules/proposals/proposalCommercialConstants";
import {
  type GeneratedInstallment,
  type PaymentScheduleConfig,
} from "@/modules/proposals/proposalCommercialUtils";

export type OnlinePaymentSetup = {
  paymentMode: InvoicePaymentCollectionMode;
  depositPercent: number;
  saveCard: boolean;
  remainderSchedule: InvoiceRemainderScheduleConfig;
};

/** Alias used by invoice UI — same shape as proposal online payment setup. */
export type InvoiceOnlinePaymentSetup = OnlinePaymentSetup;

export const defaultProposalOnlinePaymentSetup = (
  anchorDate: string,
): OnlinePaymentSetup => ({
  paymentMode: "deposit_auto",
  depositPercent: DEFAULT_DEPOSIT_PERCENT,
  saveCard: true,
  remainderSchedule: {
    timing: "weekly",
    installment_count: 4,
    balance_start_date: null,
    project_end_date: anchorDate,
  },
});

export const depositPercentFromOnlinePaymentSetup = (
  setup: OnlinePaymentSetup,
) => (setup.paymentMode === "full" ? 100 : setup.depositPercent);

export const parseProposalOnlinePaymentSetup = ({
  paymentScheduleConfig,
  depositPercent,
  anchorDate,
}: {
  paymentScheduleConfig: unknown;
  depositPercent: number;
  anchorDate: string;
}): OnlinePaymentSetup => {
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

  const legacy = paymentScheduleConfig as PaymentScheduleConfig | undefined;
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

export const onlinePaymentSetupToProposalSchedule = (
  setup: OnlinePaymentSetup,
  anchorDate: string,
): { depositPercent: number; scheduleConfig: PaymentScheduleConfig } => {
  if (setup.paymentMode === "full") {
    return {
      depositPercent: 100,
      scheduleConfig: {
        installment_frequency: "monthly",
        installment_count: 1,
        deposit_due_date: anchorDate,
        balance_start_date: null,
      },
    };
  }

  const { remainderSchedule } = setup;
  let installment_frequency: InstallmentFrequency = "monthly";
  let installment_count = remainderSchedule.installment_count;

  if (
    remainderSchedule.timing === "weekly" ||
    remainderSchedule.timing === "biweekly" ||
    remainderSchedule.timing === "monthly"
  ) {
    installment_frequency = remainderSchedule.timing;
  } else {
    installment_frequency = "custom";
    installment_count = 1;
  }

  const balance_start_date =
    remainderSchedule.timing === "project_end"
      ? remainderSchedule.project_end_date ?? anchorDate
      : remainderSchedule.timing === "invoice_due_date"
        ? anchorDate
        : remainderSchedule.balance_start_date ?? null;

  return {
    depositPercent: setup.depositPercent,
    scheduleConfig: {
      installment_frequency,
      installment_count,
      deposit_due_date: anchorDate,
      balance_start_date,
    },
  };
};

export const serializeProposalPaymentScheduleConfig = (
  setup: OnlinePaymentSetup,
  anchorDate: string,
): Record<string, unknown> => {
  const { scheduleConfig } = onlinePaymentSetupToProposalSchedule(
    setup,
    anchorDate,
  );
  return {
    ...setup,
    ...scheduleConfig,
  };
};

export const generateInstallmentsFromOnlinePaymentSetup = ({
  setup,
  oneTimeTotal,
  anchorDate,
  issueDate,
}: {
  setup: OnlinePaymentSetup;
  oneTimeTotal: number;
  anchorDate: string;
  issueDate: string;
}): GeneratedInstallment[] => {
  const depositPercent = depositPercentFromOnlinePaymentSetup(setup);
  const depositAmount =
    Math.round(oneTimeTotal * (depositPercent / 100) * 100) / 100;
  const balanceAmount = Math.max(
    Math.round((oneTimeTotal - depositAmount) * 100) / 100,
    0,
  );

  const installments: GeneratedInstallment[] = [];

  if (depositAmount > 0.01) {
    installments.push({
      installment_number: 1,
      label:
        setup.paymentMode === "full"
          ? "Payment in full"
          : `Deposit (${depositPercent}%)`,
      due_date: anchorDate,
      amount: depositAmount,
      billing_type: "one_time",
    });
  }

  if (setup.paymentMode === "deposit_auto" && balanceAmount > 0.01) {
    const balanceRows = generateInvoiceBalanceCharges({
      balanceAmount,
      config: setup.remainderSchedule,
      invoiceDueDate: anchorDate,
      issueDate,
    });

    for (const row of balanceRows) {
      installments.push({
        installment_number: installments.length + 1,
        label: row.label,
        due_date: row.due_date,
        amount: row.amount,
        billing_type: "one_time",
      });
    }
  }

  return installments;
};
