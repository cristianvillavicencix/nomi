import type { EmployeeLoan } from "@/components/atomic-crm/types";

export type LoanFormValues = Record<string, unknown>;

let receiptCounter = 0;

export const buildReceiptNumber = (prefix: "ADV" | "LOAN" | "DEDUCT", dateIso: string) => {
  const stamp = (dateIso || new Date().toISOString().slice(0, 10)).replace(/-/g, "");
  const randomSuffix = Math.random().toString(36).slice(2, 5).toUpperCase();
  const counterSuffix = (++receiptCounter).toString(36).toUpperCase().padStart(2, '0');
  return `${prefix}-${stamp}-${randomSuffix}${counterSuffix}`;
};

const roundMoney = (value: number) => Number(value.toFixed(2));

export const normalizeLoanPayload = (rawData: LoanFormValues): LoanFormValues => {
  const data = { ...rawData };
  const loanId = data.id;
  const recordType = String(data.record_type ?? "loan") as "advance" | "loan";
  const originalAmount = Number(data.original_amount ?? 0);
  const repaymentStrategy = String(data.repayment_strategy ?? "count") as
    | "count"
    | "amount";
  const paymentCount = Math.max(1, Number(data.payment_count ?? 1));
  const manualInstallment = Number(data.fixed_installment_amount ?? 0);
  const repaymentSchedule = String(data.repayment_schedule ?? "next_payroll") as
    | "next_payroll"
    | "specific_pay_date";
  const firstDeductionDate = String(data.first_deduction_date ?? "").trim();
  const loanDate = String(data.loan_date ?? new Date().toISOString().slice(0, 10));

  const fixedInstallmentAmount =
    recordType === "advance"
      ? roundMoney(originalAmount)
      : repaymentStrategy === "amount"
        ? roundMoney(manualInstallment > 0 ? manualInstallment : originalAmount)
        : roundMoney(originalAmount / paymentCount);
  const normalizedPaymentCount =
    recordType === "advance"
      ? 1
      : repaymentStrategy === "amount"
        ? Math.max(1, Math.ceil(originalAmount / Math.max(fixedInstallmentAmount, 0.01)))
        : paymentCount;

  data.record_type = recordType;
  data.original_amount = roundMoney(originalAmount);
  data.remaining_balance =
    loanId == null
      ? roundMoney(originalAmount)
      : roundMoney(Number(data.remaining_balance ?? originalAmount));
  data.payment_count = normalizedPaymentCount;
  data.fixed_installment_amount = fixedInstallmentAmount;
  data.repayment_schedule = repaymentSchedule;
  data.first_deduction_date =
    repaymentSchedule === "specific_pay_date" && firstDeductionDate ? firstDeductionDate : null;
  data.start_next_payroll = repaymentSchedule !== "specific_pay_date";
  data.deduction_mode =
    recordType === "advance" ? "single_next_payroll" : "fixed_installment";
  data.status = data.paused ? "paused" : data.active === false ? "cancelled" : "active";
  data.disbursement_receipt_number =
    String(data.disbursement_receipt_number ?? "").trim() || buildReceiptNumber(recordType === "advance" ? "ADV" : "LOAN", loanDate);
  data.disbursement_receipt_generated_at =
    data.disbursement_receipt_generated_at ?? new Date().toISOString();
  delete data.repayment_strategy;

  if (data.remaining_balance <= 0) {
    data.remaining_balance = 0;
    data.active = false;
    data.paused = false;
    data.status = "completed";
  } else if (data.status !== "cancelled") {
    data.active = true;
  }

  delete data.completed_at;

  return data;
};

export const getLoanStatus = (loan: Partial<EmployeeLoan>) => {
  if ((loan.remaining_balance ?? 0) <= 0 || loan.status === "completed") return "completed";
  if (loan.paused || loan.status === "paused") return "paused";
  if (loan.active === false || loan.status === "cancelled") return "cancelled";
  return "active";
};

export const getLoanRecordTypeLabel = (value?: string | null) =>
  value === "advance" ? "Advance" : "Loan";

export const getRepaymentSummary = (loan: Partial<EmployeeLoan>) => {
  const typeLabel = getLoanRecordTypeLabel(loan.record_type);
  if (loan.record_type === "advance") {
    return `${typeLabel}: deduct ${roundMoney(Number(loan.fixed_installment_amount ?? 0))} on the next payroll`;
  }
  const count = Number(loan.payment_count ?? 0);
  if (count > 0) {
    return `${typeLabel}: ${count} planned payroll deductions of ${roundMoney(Number(loan.fixed_installment_amount ?? 0))}`;
  }
  return `${typeLabel}: payroll deductions of ${roundMoney(Number(loan.fixed_installment_amount ?? 0))}`;
};
