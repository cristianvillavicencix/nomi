import { formatBillingDate } from "@/lbs/billing/billingDisplayUtils";
import type {
  InvoiceAmortizationRow,
  InvoicePaymentScheduleRow,
} from "@/lbs/billing/invoicePaymentUtils";
import { cn } from "@/lib/utils";

const formatMoney = (value: number, currency = "USD") =>
  new Intl.NumberFormat("en-US", { style: "currency", currency }).format(value);

const dueDateLabel = (row: InvoiceAmortizationRow) => {
  if (row.timing === "now") return "Today";
  if (row.timing === "paid") return "Paid";
  return row.dueDate ? formatBillingDate(row.dueDate) : "—";
};

const statusLabel = (row: InvoiceAmortizationRow) => {
  if (row.timing === "paid") return "Paid";
  if (row.timing === "now") return "Due today";
  if (row.autoDebit) return "Auto-debit";
  return "Scheduled";
};

const statusClass = (row: InvoiceAmortizationRow) => {
  if (row.timing === "now") {
    return "bg-amber-100 text-amber-900";
  }
  if (row.timing === "paid") {
    return "bg-emerald-100 text-emerald-800";
  }
  if (row.autoDebit) {
    return "bg-slate-100 text-slate-700";
  }
  return "bg-muted text-muted-foreground";
};

export const InvoicePortalPaymentScheduleTable = ({
  rows,
  currency = "USD",
  totalDue,
  dueToday,
  className,
}: {
  rows: InvoiceAmortizationRow[];
  currency?: string;
  totalDue: number;
  dueToday: number;
  className?: string;
}) => {
  if (!rows.length) return null;

  const hasAutoDebit = rows.some(
    (row) => row.autoDebit && row.timing === "scheduled",
  );
  const futurePayments = rows.filter((row) => row.timing === "scheduled").length;

  return (
    <div className={cn("space-y-3", className)}>
      <div>
        <p className="text-sm font-semibold text-foreground">
          Payment schedule
        </p>
        <p className="mt-0.5 text-xs text-muted-foreground">
          Amortization table — every payment on this invoice, when it is due, and
          the remaining balance after each charge.
        </p>
      </div>

      <div className="grid grid-cols-3 gap-2 rounded-lg border bg-muted/20 p-3 text-center text-xs">
        <div>
          <p className="text-muted-foreground">Invoice total</p>
          <p className="mt-0.5 font-semibold tabular-nums text-foreground">
            {formatMoney(totalDue, currency)}
          </p>
        </div>
        <div>
          <p className="text-muted-foreground">Due today</p>
          <p className="mt-0.5 font-semibold tabular-nums text-amber-900">
            {formatMoney(dueToday, currency)}
          </p>
        </div>
        <div>
          <p className="text-muted-foreground">Future payments</p>
          <p className="mt-0.5 font-semibold tabular-nums text-foreground">
            {futurePayments || (rows.length === 1 && rows[0].timing === "now" ? 0 : rows.length - 1)}
          </p>
        </div>
      </div>

      <div className="overflow-x-auto rounded-lg border">
        <table className="w-full min-w-[480px] text-sm">
          <thead>
            <tr className="border-b bg-muted/40 text-left text-[11px] uppercase tracking-wide text-muted-foreground">
              <th className="px-3 py-2.5 font-medium">#</th>
              <th className="px-3 py-2.5 font-medium">Payment</th>
              <th className="px-3 py-2.5 font-medium">Due date</th>
              <th className="px-3 py-2.5 text-right font-medium">Amount</th>
              <th className="px-3 py-2.5 text-right font-medium">Balance</th>
              <th className="px-3 py-2.5 font-medium">Status</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr
                key={`payment-${row.paymentNumber}`}
                className={cn(
                  "border-b last:border-b-0",
                  row.timing === "now" && "bg-amber-50/60",
                )}
              >
                <td className="px-3 py-3 tabular-nums text-muted-foreground">
                  {row.paymentNumber}
                </td>
                <td className="px-3 py-3 font-medium text-foreground">
                  {row.description}
                </td>
                <td className="px-3 py-3 tabular-nums text-foreground">
                  {dueDateLabel(row)}
                </td>
                <td className="px-3 py-3 text-right font-semibold tabular-nums text-foreground">
                  {formatMoney(row.amount, currency)}
                </td>
                <td className="px-3 py-3 text-right tabular-nums text-muted-foreground">
                  {formatMoney(row.balanceAfter, currency)}
                </td>
                <td className="px-3 py-3">
                  <span
                    className={cn(
                      "inline-flex rounded-full px-2 py-0.5 text-[11px] font-medium",
                      statusClass(row),
                    )}
                  >
                    {statusLabel(row)}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="bg-muted/30">
              <td
                colSpan={3}
                className="px-3 py-2.5 text-right text-xs font-medium uppercase tracking-wide text-muted-foreground"
              >
                Total payments
              </td>
              <td className="px-3 py-2.5 text-right text-base font-bold tabular-nums text-foreground">
                {formatMoney(totalDue, currency)}
              </td>
              <td colSpan={2} />
            </tr>
          </tfoot>
        </table>
      </div>

      {hasAutoDebit ? (
        <p className="text-xs leading-relaxed text-muted-foreground">
          Rows marked <strong className="font-medium">Auto-debit</strong> are
          charged automatically on the due date using the card you pay with
          today. You do not need to return to pay those installments manually.
        </p>
      ) : null}
    </div>
  );
};

export const invoicePaymentConsentLabel = (
  rows: InvoicePaymentScheduleRow[] | InvoiceAmortizationRow[],
) => {
  const hasAutoDebit = rows.some(
    (row) => row.autoDebit && row.timing === "scheduled",
  );
  if (hasAutoDebit) {
    return "I authorize the payment due today and all automatic charges listed in the payment schedule above, using the card on file.";
  }
  return "I authorize this charge and agree to the invoice terms shown above.";
};
