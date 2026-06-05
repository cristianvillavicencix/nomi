import type { Company, Contact } from "@/components/atomic-crm/types";
import { formatBillingDate } from "@/lbs/billing/billingDisplayUtils";
import { formatContactName } from "@/lbs/billing/billingUtils";
import {
  calculateInvoiceTotals,
  STRIPE_TRANSFER_FEE_LABEL,
  type InvoiceLineDraft,
} from "@/lbs/billing/invoiceLineUtils";
import { cn } from "@/lib/utils";
import {
  invoiceDocumentArticleClass,
  invoiceDocumentInnerClass,
  invoiceDocumentOuterClass,
} from "@/lbs/billing/invoiceDocumentLayout";

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
  const calculated = calculateInvoiceTotals(lines);
  const subtotal = subtotalOverride ?? calculated.subtotal;
  const discountAmount = discountOverride ?? 0;
  const feeAmount = feeOverride ?? calculated.feeAmount;
  const total = totalOverride ?? calculated.total;
  const balanceDue = balanceDueOverride ?? total;
  const contactName = formatContactName(contact);
  const contactEmail =
    contact?.email_jsonb?.find((row) => row.isPrimary)?.email?.trim() ??
    contact?.email_jsonb?.find((row) => row.email?.trim())?.email?.trim() ??
    contact?.email_jsonb?.[0]?.email?.trim();
  const contactPhone =
    contact?.phone_jsonb?.find((row) => row.isPrimary)?.number?.trim() ??
    contact?.phone_jsonb?.find((row) => row.number?.trim())?.number?.trim() ??
    contact?.phone_jsonb?.[0]?.number?.trim();

  const statusLabel =
    status === "sent"
      ? "Sent"
      : status === "paid"
        ? "Paid"
        : status === "draft"
          ? "Draft"
          : status.replace(/_/g, " ");

  return (
    <div className={cn(invoiceDocumentOuterClass, className)}>
      <article className={invoiceDocumentArticleClass}>
      {status === "sent" ? (
        <div className="pointer-events-none absolute -left-10 top-5 z-10 w-36 -rotate-45 bg-blue-600 py-1 text-center text-[10px] font-semibold uppercase tracking-wider text-white">
          Sent
        </div>
      ) : null}

      <div className={invoiceDocumentInnerClass}>
        <div className="flex flex-wrap items-start justify-between gap-8">
          <div>
            <h1 className="text-4xl font-bold tracking-tight text-slate-900">
              INVOICE
            </h1>
            <p className="mt-1 text-sm text-slate-500">
              Invoice# {invoiceNumber}
            </p>
            <div className="mt-8">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                Balance Due
              </p>
              <p className="text-4xl font-bold tabular-nums text-slate-900">
                {formatMoney(balanceDue)}
              </p>
            </div>
          </div>
          <div className="min-w-[200px] text-right text-sm">
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
            {company?.name ? (
              <p className="font-medium text-blue-700">{company.name}</p>
            ) : null}
            {contactName ? <p>{contactName}</p> : null}
            {contactEmail ? (
              <p className="text-slate-600">{contactEmail}</p>
            ) : null}
            {contactPhone ? (
              <p className="text-slate-600">{contactPhone}</p>
            ) : null}
            {!company?.name && !contactName ? (
              <p className="text-slate-400">Select a client</p>
            ) : null}
          </div>
        </div>

        <div className="mt-8 overflow-hidden rounded-md border">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-700 text-left text-xs uppercase tracking-wide text-white">
                <th className="px-3 py-2.5 font-medium">Item & Description</th>
                <th className="w-24 px-3 py-2.5 font-medium text-right">Qty</th>
                <th className="w-28 px-3 py-2.5 font-medium text-right">Rate</th>
                <th className="w-28 px-3 py-2.5 font-medium text-right">Amount</th>
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
                    <td className="px-3 py-3 align-middle text-right tabular-nums">
                      {line.quantity.toFixed(2)}
                      <div className="text-xs text-slate-500">{line.unit}</div>
                    </td>
                    <td className="px-3 py-3 align-middle text-right tabular-nums">
                      {formatMoney(line.unit_price)}
                    </td>
                    <td className="px-3 py-3 align-middle text-right font-medium tabular-nums">
                      {formatMoney(line.quantity * line.unit_price)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className="mt-4 flex justify-end">
          <div className="w-full max-w-[18rem] text-sm">
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
