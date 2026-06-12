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
    <div
      className={cn(
        "space-y-3 rounded-lg border bg-muted/20 p-4 text-sm",
        className,
      )}
    >
      <div>
        <p className="font-medium text-foreground">{title}</p>
        <p className="mt-0.5 text-xs text-muted-foreground">
          {description ?? defaultDescription}
        </p>
      </div>
      <ul className="space-y-2">
        {rows.map((row) => (
          <li
            key={row.key}
            className={cn(
              "rounded-md border bg-background px-3 py-2.5",
              row.timing === "paid" && "border-emerald-200 bg-emerald-50/50",
              row.timing === "now" && "border-amber-200 bg-amber-50/40",
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
                    Charged automatically to your saved card — no need to pay
                    again manually.
                  </p>
                ) : null}
              </div>
              <span className="shrink-0 font-semibold tabular-nums text-foreground">
                {formatMoney(row.amount, currency)}
              </span>
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
