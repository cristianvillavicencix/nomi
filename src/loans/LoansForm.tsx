import { required } from "ra-core";
import { useEffect, useMemo } from "react";
import { useFormContext, useWatch } from "react-hook-form";
import { useGetOne } from "ra-core";
import {
  BooleanInput,
  DateInput,
  NumberInput,
  ReferenceInput,
  SelectInput,
  TextInput,
  AutocompleteInput,
} from "@/components/admin";
import { useConfigurationContext } from "@/components/atomic-crm/root/ConfigurationContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { Person } from "@/components/atomic-crm/types";
import { getCompanyPaySchedule } from "@/payroll/rules";
import { buildReceiptNumber, getLoanRecordTypeLabel } from "./helpers";

const money = (value?: number | null) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(Number(value ?? 0));

const parseIsoDate = (value?: string | null) => {
  if (!value) return null;
  const date = new Date(`${value}T12:00:00`);
  return Number.isNaN(date.getTime()) ? null : date;
};

const formatDateLabel = (value?: string | null) => {
  if (!value) return "Next payroll";
  const date = parseIsoDate(value);
  if (!date) return value;
  return date.toLocaleDateString("en-US");
};

const addDays = (date: Date, days: number) => {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
};

const endOfMonth = (date: Date) =>
  new Date(date.getFullYear(), date.getMonth() + 1, 0, 12, 0, 0, 0);

const nextSemiMonthlyDate = (date: Date) => {
  const day = date.getDate();
  if (day < 15) return new Date(date.getFullYear(), date.getMonth(), 15, 12, 0, 0, 0);
  return endOfMonth(date);
};

const nextMonthlyDate = (date: Date) => endOfMonth(date);

const nextPayrollDate = (
  date: Date,
  schedule: "weekly" | "biweekly" | "semimonthly" | "monthly",
) => {
  if (schedule === "weekly") return addDays(date, 7);
  if (schedule === "biweekly") return addDays(date, 14);
  if (schedule === "semimonthly") return nextSemiMonthlyDate(addDays(date, 1));
  return nextMonthlyDate(addDays(date, 1));
};

const getDefaultTerms = ({
  recordType,
  nextDeductionLabel,
}: {
  recordType: "advance" | "loan";
  nextDeductionLabel: string;
}) => {
  if (recordType === "advance") {
    return `The employee confirms receipt of this advance and authorizes the company to recover it on ${nextDeductionLabel}. If that payroll date changes, the deduction will be applied on the next available payroll run.`;
  }

  return `The employee confirms receipt of this loan and authorizes payroll deductions according to the repayment plan shown in this document until the balance reaches zero. If the remaining balance becomes lower than a scheduled deduction, only the outstanding balance will be deducted.`;
};

export const LoansForm = () => {
  const form = useFormContext();
  const config = useConfigurationContext();
  const loanId = useWatch({ name: "id" }) as number | undefined;
  const employeeId = useWatch({ name: "employee_id" }) as number | string | undefined;
  const recordType = useWatch({ name: "record_type" }) as "advance" | "loan" | undefined;
  const repaymentStrategy = useWatch({ name: "repayment_strategy" }) as
    | "count"
    | "amount"
    | undefined;
  const originalAmount = Number(useWatch({ name: "original_amount" }) ?? 0);
  const remainingBalance = Number(useWatch({ name: "remaining_balance" }) ?? originalAmount ?? 0);
  const paymentCount = Number(useWatch({ name: "payment_count" }) ?? 1);
  const manualInstallment = Number(useWatch({ name: "fixed_installment_amount" }) ?? 0);
  const repaymentSchedule = useWatch({ name: "repayment_schedule" }) as
    | "next_payroll"
    | "specific_pay_date"
    | undefined;
  const firstDeductionDate = String(useWatch({ name: "first_deduction_date" }) ?? "").trim();
  const loanDate = String(useWatch({ name: "loan_date" }) ?? new Date().toISOString().slice(0, 10));
  const notes = String(useWatch({ name: "notes" }) ?? "").trim();
  const { data: employee } = useGetOne<Person>(
    "people",
    { id: employeeId ?? "" },
    { enabled: employeeId != null && employeeId !== "" },
  );

  const effectivePaymentCount = useMemo(() => {
    if ((recordType ?? "loan") === "advance") return 1;
    if ((repaymentStrategy ?? "count") === "amount") {
      return Math.max(1, Math.ceil(originalAmount / Math.max(manualInstallment, 0.01)));
    }
    return Math.max(1, paymentCount || 1);
  }, [manualInstallment, originalAmount, paymentCount, recordType, repaymentStrategy]);

  const autoInstallment = useMemo(() => {
    if ((recordType ?? "loan") === "advance") return originalAmount;
    if ((repaymentStrategy ?? "count") === "amount") {
      return manualInstallment > 0 ? manualInstallment : originalAmount;
    }
    return effectivePaymentCount > 0 ? originalAmount / effectivePaymentCount : 0;
  }, [effectivePaymentCount, manualInstallment, originalAmount, recordType, repaymentStrategy]);

  const receiptPreview = useMemo(
    () => buildReceiptNumber((recordType ?? "loan") === "advance" ? "ADV" : "LOAN", loanDate),
    [loanDate, recordType],
  );
  const companyPaySchedule = getCompanyPaySchedule(config.payrollSettings);
  const projectionStartDate = useMemo(() => {
    if (repaymentSchedule === "specific_pay_date" && firstDeductionDate) {
      return parseIsoDate(firstDeductionDate);
    }
    const baseDate = parseIsoDate(loanDate);
    return baseDate ? nextPayrollDate(baseDate, companyPaySchedule) : null;
  }, [companyPaySchedule, firstDeductionDate, loanDate, repaymentSchedule]);
  const projectedDeductions = useMemo(() => {
    const totalSteps = Math.max(1, (recordType ?? "loan") === "advance" ? 1 : effectivePaymentCount || 1);
    let balance = remainingBalance || originalAmount;
    let cursor = projectionStartDate ?? new Date();

    return Array.from({ length: totalSteps }, (_, index) => {
      const balanceBefore = balance;
      const scheduledAmount =
        index === totalSteps - 1 ? Math.min(balance, autoInstallment) : Math.min(balance, autoInstallment);
      balance = Math.max(0, balance - scheduledAmount);
      const installmentDate = new Date(cursor);
      if (companyPaySchedule === "weekly") {
        cursor = addDays(cursor, 7);
      } else if (companyPaySchedule === "biweekly") {
        cursor = addDays(cursor, 14);
      } else if (companyPaySchedule === "semimonthly") {
        cursor = addDays(nextSemiMonthlyDate(addDays(cursor, 1)), 0);
      } else {
        cursor = nextMonthlyDate(addDays(cursor, 1));
      }
      return {
        step: index + 1,
        amount: scheduledAmount,
        balanceBefore,
        remaining: balance,
        dateLabel: formatDateLabel(installmentDate.toISOString().slice(0, 10)),
      };
    });
  }, [
    autoInstallment,
    companyPaySchedule,
    effectivePaymentCount,
    originalAmount,
    projectionStartDate,
    recordType,
    remainingBalance,
  ]);
  const nextDeductionLabel =
    projectedDeductions[0]?.dateLabel ??
    (repaymentSchedule === "specific_pay_date" && firstDeductionDate
      ? formatDateLabel(firstDeductionDate)
      : "—");
  const employeeName = employee
    ? `${employee.first_name ?? ""} ${employee.last_name ?? ""}`.trim()
    : employeeId
      ? `Employee #${employeeId}`
      : "Select employee";
  const previewNotes =
    notes || "";
  const previewTerms = getDefaultTerms({
    recordType: (recordType ?? "loan") as "advance" | "loan",
    nextDeductionLabel,
  });

  useEffect(() => {
    if (!repaymentStrategy) {
      form.setValue(
        "repayment_strategy",
        paymentCount > 1 ? "count" : "amount",
        { shouldDirty: false, shouldTouch: false },
      );
    }
  }, [form, paymentCount, repaymentStrategy]);

  useEffect(() => {
    const nextType = (recordType ?? "loan") as "advance" | "loan";
    form.setValue(
      "deduction_mode",
      nextType === "advance" ? "single_next_payroll" : "fixed_installment",
      { shouldDirty: false, shouldTouch: false },
    );
    if (nextType === "advance") {
      form.setValue("repayment_strategy", "count", { shouldDirty: false, shouldTouch: false });
      form.setValue("payment_count", 1, { shouldDirty: false, shouldTouch: false });
      form.setValue("fixed_installment_amount", Number(form.getValues("original_amount") ?? 0), {
        shouldDirty: false,
        shouldTouch: false,
      });
    }
  }, [form, originalAmount, recordType]);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <div className="space-y-2.5">
          <Card className="border-0 shadow-none">
            <CardHeader>
              <CardTitle>Loan Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-1 items-start gap-4 md:grid-cols-2">
                <ReferenceInput source="employee_id" reference="people" filter={{ type: "employee" }}>
                  <AutocompleteInput
                    label="Employee"
                    optionText={(choice) =>
                      choice ? `${choice.first_name ?? ""} ${choice.last_name ?? ""}`.trim() : ""
                    }
                    validate={required()}
                    helperText={false}
                  />
                </ReferenceInput>
                <DateInput
                  source="loan_date"
                  label="Disbursement date"
                  validate={required()}
                  helperText={false}
                />
              </div>

              <div className="grid grid-cols-1 items-start gap-4 md:grid-cols-2">
                <SelectInput
                  source="record_type"
                  label="Record type"
                  choices={[
                    { id: "advance", name: "Advance" },
                    { id: "loan", name: "Loan" },
                  ]}
                  validate={required()}
                  helperText={false}
                />
                <NumberInput
                  source="original_amount"
                  label="Amount given"
                  validate={required()}
                  step={0.01}
                  helperText={false}
                />
              </div>

              <p className="text-sm text-muted-foreground">
                Use <span className="font-medium">Advance</span> for a one-time deduction. Use{" "}
                <span className="font-medium">Loan</span> for a repayment plan.
              </p>
            </CardContent>
          </Card>

          <Card className="border-0 shadow-none">
            <CardHeader>
              <CardTitle>Repayment Plan</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 items-start gap-4 md:grid-cols-2">
                <SelectInput
                  source="repayment_schedule"
                  label="First deduction"
                  choices={[
                    { id: "next_payroll", name: "Next payroll" },
                    { id: "specific_pay_date", name: "Specific payroll date" },
                  ]}
                  validate={required()}
                  helperText={false}
                />
                <SelectInput
                  source="deduction_mode"
                  label="Deduction mode"
                  choices={[
                    { id: "single_next_payroll", name: "Single next payroll" },
                    { id: "fixed_installment", name: "Fixed installment" },
                  ]}
                  helperText={false}
                />
              </div>

              {repaymentSchedule === "specific_pay_date" ? (
                <DateInput
                  source="first_deduction_date"
                  label="First payroll date to deduct"
                  validate={required()}
                  helperText={false}
                />
              ) : null}

              {(recordType ?? "loan") === "loan" ? (
                <div className="rounded-md border p-4 space-y-3">
                  <p className="text-sm font-medium text-muted-foreground">Installment setup</p>
                  <div className="grid grid-cols-1 items-start gap-4 md:grid-cols-2">
                    <SelectInput
                      source="repayment_strategy"
                      label="Split loan by"
                      choices={[
                        { id: "count", name: "Number of payrolls" },
                        { id: "amount", name: "Amount per payroll" },
                      ]}
                      helperText={false}
                    />
                    {(repaymentStrategy ?? "count") === "amount" ? (
                      <NumberInput
                        source="fixed_installment_amount"
                        label="Deduct each payroll"
                        step={0.01}
                        helperText={false}
                      />
                    ) : (
                      <NumberInput
                        source="payment_count"
                        label="Planned payroll deductions"
                        step={1}
                        min={1}
                        helperText={false}
                      />
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {(repaymentStrategy ?? "count") === "amount"
                      ? "Enter how much should be debited on each payroll and the system will estimate how many payrolls are needed."
                      : "Enter how many payrolls will be used and the system will split the loan amount automatically."}
                  </p>
                </div>
              ) : (
                <div className="rounded-md border p-4">
                  <NumberInput
                    source="fixed_installment_amount"
                    label="Next payroll deduction"
                    step={0.01}
                    helperText={false}
                  />
                  <p className="mt-3 text-sm text-muted-foreground">
                    Advances are recovered in a single payroll by default.
                  </p>
                </div>
              )}

              {loanId ? (
                <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                  <div className="rounded-md border p-3">
                    <BooleanInput source="active" label="Active" />
                  </div>
                  <div className="rounded-md border p-3">
                    <BooleanInput source="paused" label="Paused" />
                  </div>
                </div>
              ) : null}

              <div className="rounded-md border bg-muted/20 p-5 text-sm text-muted-foreground">
                {(recordType ?? "loan") === "advance"
                  ? "Advances are collected in one deduction by default. Use a specific payroll date only if this should wait for a later cut."
                  : "Loans stay active until payroll deductions bring the balance to zero. The record then closes automatically."}
              </div>
            </CardContent>
          </Card>

          <Card className="border-0 shadow-none">
            <CardHeader>
              <CardTitle>Notes</CardTitle>
            </CardHeader>
            <CardContent>
              <TextInput source="notes" label={false} multiline rows={4} helperText={false} />
            </CardContent>
          </Card>
        </div>

        <Card className="h-fit border-0 shadow-none xl:sticky xl:top-4">
          <CardContent className="space-y-4 p-0 text-sm">
            <div className="rounded-2xl bg-white p-4 ring-1 ring-slate-200/80">
              <div className="flex items-start justify-between gap-4 border-b border-slate-200 pb-3">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-500">
                    Payroll finance document
                  </p>
                  <p className="mt-1 text-lg font-semibold text-slate-900">{getLoanRecordTypeLabel(recordType)} receipt</p>
                </div>
                <p className="text-xs font-medium text-slate-500">{formatDateLabel(loanDate)}</p>
              </div>

              <div className="mt-3 grid gap-3 md:grid-cols-2">
                <div className="space-y-2">
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                      Receipt no.
                    </p>
                    <p className="mt-1 break-all font-semibold text-slate-900">{receiptPreview}</p>
                  </div>
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                      Employee
                    </p>
                    <p className="mt-1 font-semibold text-slate-900">{employeeName}</p>
                    <p className="text-slate-600">
                      {employee?.identification_number?.trim() || "Identification pending"}
                    </p>
                  </div>
                </div>

                <div className="grid gap-2 text-sm">
                  <div className="flex items-start justify-between gap-3">
                    <p className="text-slate-500">Principal amount</p>
                    <p className="text-right font-semibold text-slate-900">{money(originalAmount)}</p>
                  </div>
                  <div className="flex items-start justify-between gap-3">
                    <p className="text-slate-500">Total to repay</p>
                    <p className="text-right font-semibold text-slate-900">
                      {money(remainingBalance || originalAmount)}
                    </p>
                  </div>
                  <div className="flex items-start justify-between gap-3">
                    <p className="text-slate-500">Next deduction</p>
                    <p className="text-right font-semibold text-slate-900">{nextDeductionLabel}</p>
                  </div>
                  <div className="flex items-start justify-between gap-3">
                    <p className="text-slate-500">Plan</p>
                    <p className="text-right font-semibold text-slate-900">
                      {(recordType ?? "loan") === "advance"
                        ? "Single payroll deduction"
                        : `${effectivePaymentCount || 1} payroll cuts`}
                    </p>
                  </div>
                </div>
              </div>

              <div className="mt-4 space-y-3 rounded-2xl bg-white/90 p-4 shadow-sm ring-1 ring-slate-200/80">
                <div className="flex items-end justify-between gap-3">
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                      Payroll deduction plan
                    </p>
                    <p className="mt-1 text-slate-600">
                      {(recordType ?? "loan") === "advance"
                        ? "One payroll deduction"
                        : `${effectivePaymentCount || 1} planned payroll deductions`}
                    </p>
                  </div>
                  <p className="font-semibold text-slate-900">{money(autoInstallment)}</p>
                </div>

                <div className="overflow-hidden rounded-2xl border border-slate-200">
                  <div className="grid grid-cols-[72px_110px_1fr_1fr] bg-slate-100 px-3 py-2 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                    <div>Cut</div>
                    <div>Date</div>
                    <div>Payment</div>
                    <div>Balance After</div>
                  </div>
                  <div className="divide-y divide-slate-200 bg-white">
                    {projectedDeductions.map((item) => (
                      <div
                        key={item.step}
                        className="grid grid-cols-[72px_110px_1fr_1fr] items-center px-3 py-2 text-sm"
                      >
                        <div className="font-medium text-slate-900">{item.step}</div>
                        <div className="text-slate-600">{item.dateLabel}</div>
                        <div className="font-medium text-slate-900">{money(item.amount)}</div>
                        <div className="font-medium text-slate-900">{money(item.remaining)}</div>
                      </div>
                    ))}
                  </div>
                  <div className="grid grid-cols-2 gap-2 border-t border-slate-200 bg-slate-50 px-3 py-3 text-xs text-slate-600">
                    <div>
                      <span className="font-medium text-slate-700">Current balance:</span>{" "}
                      {money(remainingBalance || originalAmount)}
                    </div>
                    <div>
                      <span className="font-medium text-slate-700">After last deduction:</span>{" "}
                      {money(projectedDeductions.at(-1)?.remaining ?? 0)}
                    </div>
                  </div>
                </div>
              </div>

              <div className="mt-4 rounded-2xl bg-white/90 p-4">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                  Terms
                </p>
                <p className="mt-2 leading-6 text-slate-700">{previewTerms}</p>
                {previewNotes ? (
                  <div className="mt-4 border-t border-slate-200 pt-4">
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                      Additional notes
                    </p>
                    <p className="mt-2 leading-6 text-slate-700">{previewNotes}</p>
                  </div>
                ) : null}
              </div>

              <div className="mt-6 grid grid-cols-2 gap-6 pt-2 text-xs text-slate-500">
                <div className="pt-2">
                  <div className="border-t border-slate-300 pt-2">
                    <p className="font-semibold text-slate-700">Employee signature</p>
                    <div className="mt-6 h-5" />
                  </div>
                </div>
                <div className="pt-2">
                  <div className="border-t border-slate-300 pt-2">
                    <p className="font-semibold text-slate-700">Company signature</p>
                    <div className="mt-6 h-5" />
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};
