import type { Company, Contact } from "@/components/atomic-crm/types";
import {
  formatBillingDate,
  isClientInvoiceOverdue,
} from "@/modules/billing/billingDisplayUtils";
import {
  formatBillToNameLine,
  resolveBillToDisplay,
} from "@/modules/billing/billingUtils";
import {
  calculateInvoiceTotals,
  STRIPE_TRANSFER_FEE_LABEL,
  type InvoiceLineDraft,
} from "@/modules/billing/invoiceLineUtils";
import { cn } from "@/lib/utils";
import {
  invoiceDocumentArticleClass,
  invoiceDocumentInnerClass,
  invoiceDocumentOuterClass,
} from "@/modules/billing/invoiceDocumentLayout";

const formatMoney = (value: number) =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(value);

type InvoiceDocumentPreviewProps = {
  organizationName: string;
  organizationWebsite?: string | null;
  organizationAddress?: string | null;
  invoiceNumber?: string;
  status?: string;
  issueDate: string;
  dueDate: string;
  terms: string;
  company?: Company | null;
  contact?: Contact | null;
  lines: InvoiceLineDraft[];
  termsAndConditions?: string | null;
  subtotal?: number;
  discountAmount?: number;
  feeAmount?: number;
  total?: number;
  /** Shown in Balance Due row; defaults to total. */
  balanceDue?: number;
  className?: string;
};

export const InvoiceDocumentPreview = ({
  organizationName,
  organizationWebsite,
  organizationAddress,
  invoiceNumber = "DRAFT",
  status = "draft",
  issueDate,
  dueDate,
  terms,
  company,
  contact,
  lines,
  termsAndConditions,
  subtotal: subtotalOverride,
  discountAmount: discountOverride,
  feeAmount: feeOverride,
  total: totalOverride,
  balanceDue: balanceDueOverride,
  className,
}: InvoiceDocumentPreviewProps) => {
  const discountAmount = discountOverride ?? 0;
  const discountPercent =
    subtotalOverride != null && subtotalOverride > 0 && discountAmount > 0
      ? (discountAmount / subtotalOverride) * 100
      : 0;
  const calculated = calculateInvoiceTotals(lines, discountPercent);
  const subtotal = subtotalOverride ?? calculated.subtotal;
  const feeAmount = feeOverride ?? calculated.feeAmount;
  const total = totalOverride ?? calculated.total;
  const balanceDue = balanceDueOverride ?? total;
  const billToDisplay = resolveBillToDisplay(company, contact);
  const billToNameLine = formatBillToNameLine(company, contact);

  const statusLabel = isClientInvoiceOverdue({ status, due_date: dueDate })
    ? "Overdue"
    : status === "sent"
      ? "Sent"
      : status === "paid"
        ? "Paid"
        : status === "draft"
          ? "Draft"
          : status.replace(/_/g, " ");

  const statusRibbon = isClientInvoiceOverdue({ status, due_date: dueDate })
    ? { label: "Overdue", className: "bg-red-600" }
    : status === "sent"
      ? { label: "Sent", className: "bg-blue-600" }
      : status === "paid"
        ? { label: "Paid", className: "bg-emerald-600" }
        : null;

  return (
    <div className={cn(invoiceDocumentOuterClass, className)}>
      <article className={invoiceDocumentArticleClass}>
        {statusRibbon ? (
          <div
            className={cn(
              "pointer-events-none absolute -left-6 top-4 z-10 w-28 -rotate-45 py-1 text-center text-[9px] font-semibold uppercase tracking-wider text-white sm:-left-10 sm:top-5 sm:w-36 sm:text-[10px]",
              statusRibbon.className,
            )}
          >
            {statusRibbon.label}
          </div>
        ) : null}

        <div className={invoiceDocumentInnerClass}>
          <div className="flex flex-col gap-6 sm:flex-row sm:flex-wrap sm:items-start sm:justify-between sm:gap-8">
            <div className="min-w-0">
              <h1 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-4xl">
                INVOICE
              </h1>
              <p className="mt-1 text-sm text-slate-500">
                Invoice# {invoiceNumber}
              </p>
              <div className="mt-6 sm:mt-8">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                  Balance Due
                </p>
                <p className="text-2xl font-bold tabular-nums text-slate-900 sm:text-4xl">
                  {formatMoney(balanceDue)}
                </p>
              </div>
            </div>
            <div className="min-w-0 text-left text-sm sm:min-w-[200px] sm:text-right">
              <p className="text-base font-semibold text-slate-900">
                {organizationName}
              </p>
              {organizationAddress ? (
                <p className="mt-1 whitespace-pre-line text-slate-600">
                  {organizationAddress}
                </p>
              ) : null}
              {organizationWebsite ? (
                <p className="mt-1 text-blue-600">{organizationWebsite}</p>
              ) : null}
              <p className="mt-3 inline-flex rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium capitalize text-slate-700">
                {statusLabel}
              </p>
            </div>
          </div>

          <div className="mt-8 grid gap-6 sm:grid-cols-2">
            <div className="space-y-3 text-sm">
              <div>
                <p className="text-slate-500">Invoice Date</p>
                <p className="font-medium">{formatBillingDate(issueDate)}</p>
              </div>
              <div>
                <p className="text-slate-500">Terms</p>
                <p className="font-medium">{terms}</p>
              </div>
              <div>
                <p className="text-slate-500">Due Date</p>
                <p className="font-medium">{formatBillingDate(dueDate)}</p>
              </div>
            </div>
            <div className="text-sm">
              <p className="mb-2 font-semibold">Bill To</p>
              {billToNameLine ? (
                <p className="font-medium text-blue-700">{billToNameLine}</p>
              ) : null}
              {billToDisplay.addressLines.map((line) => (
                <p key={line} className="text-slate-600">
                  {line}
                </p>
              ))}
              {billToDisplay.email ? (
                <p className="text-slate-600">{billToDisplay.email}</p>
              ) : null}
              {billToDisplay.phone ? (
                <p className="text-slate-600">{billToDisplay.phone}</p>
              ) : null}
              {!billToNameLine ? (
                <p className="text-slate-400">Select a client</p>
              ) : null}
            </div>
          </div>

          <div className="mt-8 overflow-x-auto rounded-md border [-webkit-overflow-scrolling:touch]">
            <table className="w-full min-w-[300px] table-fixed text-xs sm:text-sm">
              <colgroup>
                <col />
                <col style={{ width: "3.75rem" }} />
                <col style={{ width: "5.25rem" }} />
                <col style={{ width: "5.5rem" }} />
              </colgroup>
              <thead>
                <tr className="bg-slate-700 text-left text-xs uppercase tracking-wide text-white">
                  <th className="px-3 py-2.5 font-medium">
                    Item & Description
                  </th>
                  <th className="px-1 py-2.5 font-medium text-center">Qty</th>
                  <th className="px-1 py-2.5 font-medium text-center">Rate</th>
                  <th className="px-1 py-2.5 font-medium text-center">
                    Amount
                  </th>
                </tr>
              </thead>
              <tbody>
                {lines.length === 0 ? (
                  <tr>
                    <td
                      colSpan={4}
                      className="px-3 py-8 text-center text-slate-400"
                    >
                      No line items yet
                    </td>
                  </tr>
                ) : (
                  lines.map((line) => (
                    <tr key={line.key} className="border-t">
                      <td className="px-3 py-3 align-top">
                        <div className="font-medium text-foreground">
                          {line.title || "—"}
                        </div>
                        {line.item_detail ? (
                          <div className="mt-1 whitespace-pre-wrap text-xs leading-relaxed text-muted-foreground">
                            {line.item_detail}
                          </div>
                        ) : null}
                      </td>
                      <td className="px-1 py-3 align-middle text-center tabular-nums">
                        {line.quantity.toFixed(2)}
                      </td>
                      <td className="px-1 py-3 align-middle text-center tabular-nums">
                        {formatMoney(line.unit_price)}
                      </td>
                      <td className="px-1 py-3 align-middle text-center font-medium tabular-nums">
                        {formatMoney(line.quantity * line.unit_price)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          <div className="mt-4 flex justify-end">
            <div className="w-full max-w-none text-sm sm:max-w-[18rem]">
              <div className="grid grid-cols-[minmax(0,1fr)_7rem] gap-x-4">
                <span className="flex min-h-8 items-center text-slate-600">
                  Sub Total
                </span>
                <span className="flex min-h-8 items-center justify-end tabular-nums">
                  {formatMoney(subtotal)}
                </span>
                {discountAmount > 0 ? (
                  <>
                    <span className="flex min-h-8 items-center text-slate-600">
                      Discount
                    </span>
                    <span className="flex min-h-8 items-center justify-end tabular-nums text-red-600">
                      -{formatMoney(discountAmount)}
                    </span>
                  </>
                ) : null}
                {feeAmount > 0 ? (
                  <>
                    <span className="flex min-h-8 items-center text-slate-600">
                      Transfer Fee{" "}
                      <span className="ml-1 text-[11px] font-normal text-slate-400">
                        ({STRIPE_TRANSFER_FEE_LABEL})
                      </span>
                    </span>
                    <span className="flex min-h-8 items-center justify-end tabular-nums">
                      {formatMoney(feeAmount)}
                    </span>
                  </>
                ) : null}
                <div className="col-span-2 my-1 border-t border-slate-200" />
                <span className="flex min-h-8 items-center font-semibold">
                  Total
                </span>
                <span className="flex min-h-8 items-center justify-end font-semibold tabular-nums">
                  {formatMoney(total)}
                </span>
                <span className="flex min-h-8 items-center font-semibold">
                  Balance Due
                </span>
                <span className="flex min-h-8 items-center justify-end font-semibold tabular-nums">
                  {formatMoney(balanceDue)}
                </span>
              </div>
            </div>
          </div>

          {termsAndConditions?.trim() ? (
            <div className="mt-8 border-t pt-6">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                Terms & Conditions
              </p>
              <p className="mt-2 whitespace-pre-line text-sm leading-relaxed text-slate-600">
                {termsAndConditions.trim()}
              </p>
            </div>
          ) : null}
        </div>
      </article>
    </div>
  );
};
