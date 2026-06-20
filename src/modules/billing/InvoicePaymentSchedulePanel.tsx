import { formatBillingDate } from "@/modules/billing/billingDisplayUtils";
import type { InvoicePaymentScheduleRow } from "@/modules/billing/invoicePaymentUtils";
import { cn } from "@/lib/utils";

const formatMoney = (value: number, currency = "USD") =>
  new Intl.NumberFormat("en-US", { style: "currency", currency }).format(value);

const timingLabel = (row: InvoicePaymentScheduleRow) => {
  if (row.timing === "paid") return "Paid";
  if (row.timing === "now") return "Pay now";
  if (row.autoDebit) return "Auto-debit";
  return "Due by";
};

const timingDate = (row: InvoicePaymentScheduleRow) => {
  if (row.timing === "now") return "Today";
  if (row.timing === "paid") return "Completed";
  return row.dueDate ? formatBillingDate(row.dueDate) : "On due date";
};

export const InvoicePaymentSchedulePanel = ({
  rows,
  currency = "USD",
  className,
  title = "Payment schedule",
  description,
}: {
  rows: InvoicePaymentScheduleRow[];
  currency?: string;
  className?: string;
  title?: string;
  description?: string;
}) => {
  if (!rows.length) return null;

  const isDepositPlan = rows.some(
    (row) =>
      row.key === "deposit" ||
      row.key === "remainder" ||
      row.key.startsWith("remainder-"),
  );
  const defaultDescription = isDepositPlan
    ? "Review what you pay today and what will be charged later."
    : "Amount due on this invoice.";

  return (
    <div className={cn("space-y-3 text-sm", className)}>
      <div>
        <p className="font-medium text-foreground">{title}</p>
        <p className="mt-0.5 text-xs text-muted-foreground">
          {description ?? defaultDescription}
        </p>
      </div>
      <ul className="space-y-3">
        {rows.map((row, index) => (
          <li key={row.key} className="relative pl-4">
            {index > 0 ? (
              <div
                className="absolute -top-3 left-1.5 h-3 w-px bg-border"
                aria-hidden
              />
            ) : null}
            <div
              className={cn(
                "relative py-0.5",
                "before:absolute before:-left-4 before:top-2 before:size-1.5 before:rounded-full before:bg-muted-foreground/40",
                row.timing === "paid" && "before:bg-success",
                row.timing === "now" && "before:bg-warning",
              )}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-medium text-foreground">{row.label}</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {timingLabel(row)} · {timingDate(row)}
                  </p>
                  {row.autoDebit && row.timing === "scheduled" ? (
                    <p className="mt-1 text-[11px] text-muted-foreground">
                      Charged automatically to the saved card.
                    </p>
                  ) : null}
                </div>
                <span className="shrink-0 font-semibold tabular-nums text-foreground">
                  {formatMoney(row.amount, currency)}
                </span>
              </div>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
};

export const invoicePaymentConsentLabel = (
  rows: InvoicePaymentScheduleRow[],
) => {
  const hasAutoDebit = rows.some(
    (row) => row.autoDebit && row.timing === "scheduled",
  );
  if (hasAutoDebit) {
    return "I authorize the deposit payment today and automatic charges for the remaining balance on the dates listed above using the card on file.";
  }
  return "I authorize this charge and agree to the invoice terms shown above.";
};
