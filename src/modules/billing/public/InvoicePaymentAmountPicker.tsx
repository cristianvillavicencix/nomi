import { formatBillingDate } from "@/modules/billing/billingDisplayUtils";
import type { InvoiceAmortizationRow } from "@/modules/billing/invoicePaymentUtils";
import type { InvoiceRemainderScheduleConfig } from "@/modules/billing/invoiceRemainderSchedule";
import { filterRemainderInstallmentRows, findNextDueInstallment } from "@/modules/billing/public/invoicePaymentAmount";
import { publicInvoicePaymentSectionPadding } from "@/modules/billing/public/payInvoiceDialogLayout";
import { Checkbox } from "@/components/ui/checkbox";
import { Check, ChevronDown } from "lucide-react";
import { useMemo, useState } from "react";
import { cn } from "@/lib/utils";

const formatMoney = (value: number, currency = "USD") =>
  new Intl.NumberFormat("en-US", { style: "currency", currency }).format(value);

type InvoicePaymentAmountPickerProps = {
  balanceDue: number;
  depositDue: number;
  upfrontPercent: number;
  autoChargeRemainder: boolean;
  saveCardForFutureCharges: boolean;
  depositPaid: boolean;
  remainderSchedule?: InvoiceRemainderScheduleConfig | null;
  amortizationRows: InvoiceAmortizationRow[];
  currency?: string;
  selectedInstallmentNumbers: number[];
  onToggleInstallment: (paymentNumber: number) => void;
  onSelectAllInstallments: () => void;
  onClearSelectedInstallments: () => void;
  previewDueDatesByInstallmentNumber?: Record<number, string>;
};

const InstallmentSchedule = ({
  upcomingInstallments,
  selectedInstallmentNumbers,
  onToggleInstallment,
  currency,
  previewDueDatesByInstallmentNumber,
}: {
  upcomingInstallments: InvoiceAmortizationRow[];
  selectedInstallmentNumbers: number[];
  onToggleInstallment: (paymentNumber: number) => void;
  currency: string;
  previewDueDatesByInstallmentNumber?: Record<number, string>;
}) => {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="mt-3 flex w-full items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <span>
          {open ? "Hide payment schedule" : "View payment schedule"}
          {" "}({upcomingInstallments.length})
        </span>
        <ChevronDown
          className={cn(
            "size-4 transition-transform",
            open && "rotate-180",
          )}
        />
      </button>

      {open ? (
        <div className="mt-2 space-y-1">
          {upcomingInstallments.map((row) => {
            const installmentNumber = row.remainderInstallmentNumber;
            const displayDate =
              (installmentNumber != null
                ? previewDueDatesByInstallmentNumber?.[installmentNumber]
                : undefined) ?? row.dueDate;
            const dueLabel =
              row.timing === "now"
                ? "Due today"
                : displayDate
                  ? `Due ${formatBillingDate(displayDate)}`
                  : "Scheduled";
            const checked = selectedInstallmentNumbers.includes(row.paymentNumber);
            const checkboxId = `installment-${row.paymentNumber}`;

            return (
              <label
                key={row.paymentNumber}
                htmlFor={checkboxId}
                className="flex cursor-pointer items-center justify-between gap-3 py-2 text-sm"
              >
                <span className="flex min-w-0 items-center gap-2.5">
                  <Checkbox id={checkboxId} checked={checked} onCheckedChange={() => onToggleInstallment(row.paymentNumber)} />
                  <span className="min-w-0">
                    <span className="block text-foreground">{row.description}</span>
                    <span className="block text-xs text-muted-foreground">{dueLabel}</span>
                  </span>
                </span>
                <span className="shrink-0 tabular-nums text-foreground">
                  {formatMoney(row.amount, currency)}
                </span>
              </label>
            );
          })}
        </div>
      ) : null}
    </>
  );
};

const SelectedPaymentRow = ({
  title,
  subtitle,
  amount,
  currency,
  selected,
}: {
  title: string;
  subtitle: string;
  amount: number;
  currency: string;
  selected?: boolean;
}) => (
  <div
    className={cn(
      "flex items-center justify-between gap-3 rounded-xl px-4 py-3.5",
      selected
        ? "border border-blue-200 bg-blue-50/40"
        : "border border-transparent",
    )}
  >
    <div className="flex min-w-0 items-start gap-3">
      {selected ? (
        <span className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-blue-600 text-white">
          <Check className="size-3" strokeWidth={3} />
        </span>
      ) : null}
      <div className="min-w-0">
        <p className="text-sm font-medium text-foreground">{title}</p>
        <p className="text-sm text-muted-foreground">{subtitle}</p>
      </div>
    </div>
    <p className="shrink-0 text-sm font-medium tabular-nums text-foreground">
      {formatMoney(amount, currency)}
    </p>
  </div>
);

export const InvoicePaymentAmountPicker = ({
  balanceDue,
  depositDue,
  upfrontPercent,
  depositPaid,
  amortizationRows,
  currency = "USD",
  selectedInstallmentNumbers,
  onToggleInstallment,
  onSelectAllInstallments,
  onClearSelectedInstallments,
  previewDueDatesByInstallmentNumber,
}: InvoicePaymentAmountPickerProps) => {
  const upcomingInstallments = useMemo(
    () => filterRemainderInstallmentRows(amortizationRows),
    [amortizationRows],
  );

  const hasInstallmentPlan = upcomingInstallments.length > 0;
  const showDepositRow =
    !depositPaid && depositDue > 0.01 && depositDue < balanceDue - 0.01;
  const allSelected =
    hasInstallmentPlan &&
    upcomingInstallments.every((row) =>
      selectedInstallmentNumbers.includes(row.paymentNumber),
    );

  const payAllButton = hasInstallmentPlan || showDepositRow ? (
    <button
      type="button"
      onClick={allSelected ? onClearSelectedInstallments : onSelectAllInstallments}
      className="shrink-0 rounded-md bg-blue-600 px-2.5 py-1 text-xs font-medium text-white hover:bg-blue-700"
    >
      {`Pay all · ${formatMoney(balanceDue, currency)}`}
    </button>
  ) : null;

  if (!hasInstallmentPlan && !showDepositRow) {
    return null;
  }

  if (depositPaid && hasInstallmentPlan) {
    const nextDue = findNextDueInstallment(upcomingInstallments);
    const nextDueLabel =
      nextDue?.timing === "now"
        ? "Due today"
        : nextDue?.dueDate
          ? `Due ${formatBillingDate(nextDue.dueDate)}`
          : "Scheduled";

    return (
      <div className={`${publicInvoicePaymentSectionPadding} pb-1 pt-5`}>
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm text-foreground">Next payment due</p>
          {payAllButton}
        </div>

        {nextDue ? (
          <SelectedPaymentRow
            title={nextDue.description}
            subtitle={nextDueLabel}
            amount={nextDue.amount}
            currency={currency}
            selected
          />
        ) : null}

        <InstallmentSchedule
          upcomingInstallments={upcomingInstallments}
          selectedInstallmentNumbers={selectedInstallmentNumbers}
          onToggleInstallment={onToggleInstallment}
          currency={currency}
          previewDueDatesByInstallmentNumber={previewDueDatesByInstallmentNumber}
        />
      </div>
    );
  }

  return (
    <div className={`${publicInvoicePaymentSectionPadding} pb-1 pt-5`}>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-foreground">
          {showDepositRow ? "Deposit due today" : "Payment amount"}
        </p>
        {payAllButton}
      </div>

      {showDepositRow ? (
        <SelectedPaymentRow
          title={`Deposit (${Math.round(upfrontPercent)}%)`}
          subtitle="Due today"
          amount={depositDue}
          currency={currency}
          selected
        />
      ) : null}

      {hasInstallmentPlan ? (
        <InstallmentSchedule
          upcomingInstallments={upcomingInstallments}
          selectedInstallmentNumbers={selectedInstallmentNumbers}
          onToggleInstallment={onToggleInstallment}
          currency={currency}
          previewDueDatesByInstallmentNumber={previewDueDatesByInstallmentNumber}
        />
      ) : null}
    </div>
  );
};
