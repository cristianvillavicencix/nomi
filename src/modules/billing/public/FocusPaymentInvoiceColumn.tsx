import { Info } from "lucide-react";
import { formatBillingDate } from "@/modules/billing/billingDisplayUtils";
import {
  lineItemsToInvoiceDrafts,
  STRIPE_TRANSFER_FEE_LABEL,
} from "@/modules/billing/invoiceLineUtils";
import type { InvoicePaymentScheduleRow } from "@/modules/billing/invoicePaymentUtils";
import type { PublicInvoicePayload } from "@/modules/billing/public/publicInvoiceApi";
import { formatPublicInvoiceLineTitle } from "@/modules/billing/public/publicInvoiceDeliveryMessage";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { PRODUCT_MARK_SRC, PRODUCT_NAME } from "@/lib/branding";
import { cn } from "@/lib/utils";

const formatMoney = (value: number, currency = "USD") =>
  new Intl.NumberFormat("en-US", { style: "currency", currency }).format(value);

const buildBillToLine = (payload: PublicInvoicePayload) => {
  const { contact_name: contact, company_name: company } = payload.bill_to;
  if (contact && company) return `${contact} · ${company}`;
  if (contact) return contact;
  if (company) return company;
  return null;
};

const scheduleRowTitle = (row: InvoicePaymentScheduleRow) => {
  if (row.key === "deposit") return "Deposit";
  if (row.key === "full") return "Amount due";
  return row.label.replace(/\s*\(auto-debit\)/i, "");
};

const scheduleRowSubtext = (row: InvoicePaymentScheduleRow) => {
  if (row.timing === "paid") return "Paid";
  if (row.timing === "now") return "Charged when you confirm payment";
  const date = row.dueDate ? formatBillingDate(row.dueDate) : "On due date";
  return row.autoDebit ? `${date} · automatic` : date;
};

const formatScheduleMeta = (rows: InvoicePaymentScheduleRow[]) => {
  const upcoming = rows.filter((row) => row.timing !== "paid");
  if (upcoming.length === 0) return null;
  const lastScheduled = [...rows]
    .reverse()
    .find((row) => row.timing === "scheduled" && row.dueDate);
  const endLabel = lastScheduled?.dueDate
    ? new Date(`${lastScheduled.dueDate}T12:00:00`).toLocaleDateString(
        "en-US",
        { month: "short", year: "numeric" },
      )
    : null;
  const countLabel = `${upcoming.length} payment${upcoming.length === 1 ? "" : "s"}`;
  return endLabel ? `${countLabel} · ends ${endLabel}` : countLabel;
};

const depositHeroCopy = ({
  currency,
  upfrontPercent,
  chargeAmount,
  scheduleRows,
  balanceDue,
}: {
  currency: string;
  upfrontPercent: number;
  chargeAmount: number;
  scheduleRows: InvoicePaymentScheduleRow[];
  balanceDue: number;
}) => {
  const percentLabel = Math.round(upfrontPercent);
  const remainderRows = scheduleRows.filter(
    (row) =>
      row.key === "remainder" || row.key.startsWith("remainder-"),
  );
  if (remainderRows.length === 0) {
    return {
      eyebrow: "Due today",
      amount: chargeAmount > 0.01 ? chargeAmount : balanceDue,
      detail: null as string | null,
    };
  }

  const installmentAmount = remainderRows[0]?.amount ?? 0;
  const sameAmount = remainderRows.every(
    (row) => Math.abs(row.amount - installmentAmount) < 0.02,
  );
  const detail = sameAmount
    ? `The rest is split into ${remainderRows.length} automatic monthly payments of ${formatMoney(installmentAmount, currency)}`
    : `The rest is split into ${remainderRows.length} automatic monthly payments`;

  return {
    eyebrow: `Due today · ${percentLabel}% deposit`,
    amount: chargeAmount,
    detail,
  };
};

export type FocusPaymentInvoiceSummary = {
  currency: string;
  total: number;
  balanceDue: number;
  balanceDueFormatted: string;
  chargeAmount: number;
  upfrontPercent: number;
  scheduleRows: InvoicePaymentScheduleRow[];
};

export const FocusPaymentInvoiceColumn = ({
  payload,
  summary,
  className,
}: {
  payload: PublicInvoicePayload;
  summary: FocusPaymentInvoiceSummary;
  className?: string;
}) => {
  const { invoice, line_items, organization } = payload;
  const currency = summary.currency;
  const feeAmount = Number(invoice.fee_amount) || 0;
  const lines = lineItemsToInvoiceDrafts(line_items);
  const billToLine = buildBillToLine(payload);
  const isDepositPlan = summary.scheduleRows.some(
    (row) =>
      row.key === "deposit" ||
      row.key === "remainder" ||
      row.key.startsWith("remainder-"),
  );
  const hero = isDepositPlan
    ? depositHeroCopy(summary)
    : {
        eyebrow: "Due today",
        amount: summary.balanceDue,
        detail: null as string | null,
      };
  const scheduleMeta = formatScheduleMeta(summary.scheduleRows);
  const hasAutoDebit = summary.scheduleRows.some(
    (row) => row.autoDebit && row.timing === "scheduled",
  );

  return (
    <div className={cn("flex flex-col", className)}>
      <header className="flex items-start gap-3 px-4 pb-4 pt-5 sm:px-6 sm:pt-6">
        <img
          src={PRODUCT_MARK_SRC}
          alt={PRODUCT_NAME}
          className="size-9 shrink-0 rounded-lg object-contain"
        />
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-foreground">
            {organization.name}
          </p>
          <p className="truncate text-sm text-muted-foreground">
            Invoice {invoice.invoice_number}
          </p>
        </div>
      </header>

      <section className="px-4 pb-5 text-center sm:px-6">
        <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-blue-600">
          {hero.eyebrow}
        </p>
        <p className="mt-2 text-[2.15rem] font-bold tabular-nums leading-none tracking-tight text-foreground sm:text-[2.4rem]">
          {formatMoney(hero.amount, currency)}
        </p>
        {hero.detail ? (
          <p className="mx-auto mt-3 max-w-[22rem] text-sm leading-relaxed text-muted-foreground">
            {hero.detail}
          </p>
        ) : null}
        <p className="mt-4 text-sm text-muted-foreground">
          Invoice total{" "}
          <span className="font-medium text-foreground">
            {formatMoney(summary.total, currency)}
          </span>
        </p>
        {billToLine ? (
          <p className="mt-1.5 text-xs text-muted-foreground">{billToLine}</p>
        ) : null}
      </section>

      {isDepositPlan ? (
        <section className="border-t border-border/50 px-4 py-5 sm:px-6">
          <div className="mb-4 flex items-baseline justify-between gap-3">
            <p className="text-sm font-semibold text-foreground">
              Payment schedule
            </p>
            {scheduleMeta ? (
              <p className="shrink-0 text-xs text-muted-foreground">
                {scheduleMeta}
              </p>
            ) : null}
          </div>
          <ul className="space-y-4">
            {summary.scheduleRows.map((row, index) => {
              const isToday = row.timing === "now";
              return (
                <li key={row.key} className="relative flex gap-3 pl-1">
                  {index < summary.scheduleRows.length - 1 ? (
                    <div
                      className="absolute left-[7px] top-4 h-[calc(100%+0.5rem)] w-px bg-border"
                      aria-hidden
                    />
                  ) : null}
                  <span
                    className={cn(
                      "relative z-[1] mt-1 size-3.5 shrink-0 rounded-full border-2 bg-background",
                      isToday
                        ? "border-blue-600 bg-blue-600"
                        : row.timing === "paid"
                          ? "border-emerald-500 bg-emerald-500"
                          : "border-muted-foreground/35",
                    )}
                    aria-hidden
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <p
                            className={cn(
                              "text-sm font-semibold",
                              isToday ? "text-blue-700" : "text-foreground",
                            )}
                          >
                            {scheduleRowTitle(row)}
                          </p>
                          {isToday ? (
                            <span className="rounded-full bg-blue-600 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white">
                              Today
                            </span>
                          ) : null}
                        </div>
                        <p className="mt-0.5 text-xs text-muted-foreground">
                          {scheduleRowSubtext(row)}
                        </p>
                      </div>
                      <span
                        className={cn(
                          "shrink-0 text-sm font-semibold tabular-nums",
                          isToday ? "text-blue-700" : "text-foreground",
                        )}
                      >
                        {formatMoney(row.amount, currency)}
                      </span>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>

          {hasAutoDebit ? (
            <div className="mt-5 flex gap-2.5 rounded-xl bg-muted/50 px-3.5 py-3 text-xs leading-relaxed text-muted-foreground">
              <Info
                className="mt-0.5 size-3.5 shrink-0 text-muted-foreground"
                aria-hidden
              />
              <p>
                Later payments are charged automatically to the saved payment
                method. You'll get a receipt before each charge.
              </p>
            </div>
          ) : null}
        </section>
      ) : null}

      <div className="border-t border-border/50 px-2 sm:px-3">
        <Accordion type="single" collapsible defaultValue="invoice-details" className="w-full">
          <AccordionItem value="invoice-details" className="border-0">
            <AccordionTrigger className="px-2 py-4 text-sm font-semibold hover:no-underline sm:px-3">
              Invoice details
            </AccordionTrigger>
            <AccordionContent className="px-2 pb-5 sm:px-3">
              <div className="space-y-3">
                {lines.map((line) => {
                  const lineTotal = line.quantity * line.unit_price;
                  const subtext = line.item_detail?.trim() || null;
                  return (
                    <div
                      key={line.key}
                      className="flex items-start justify-between gap-3"
                    >
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-foreground">
                          {formatPublicInvoiceLineTitle(line.title)}
                        </p>
                        {subtext ? (
                          <p className="mt-0.5 text-xs text-muted-foreground">
                            {subtext}
                          </p>
                        ) : null}
                      </div>
                      <p className="shrink-0 text-sm tabular-nums text-foreground">
                        {formatMoney(lineTotal, currency)}
                      </p>
                    </div>
                  );
                })}
                {feeAmount > 0 ? (
                  <div className="flex items-start justify-between gap-3">
                    <p className="text-sm text-foreground">Processing fee</p>
                    <p className="shrink-0 text-sm tabular-nums text-foreground">
                      {formatMoney(feeAmount, currency)}
                    </p>
                  </div>
                ) : null}
                <div className="flex items-start justify-between gap-3 border-t border-border/40 pt-3">
                  <p className="text-sm font-semibold text-foreground">Total</p>
                  <p className="shrink-0 text-sm font-semibold tabular-nums text-foreground">
                    {formatMoney(summary.total, currency)}
                  </p>
                </div>
                {feeAmount > 0 ? (
                  <p className="text-xs text-muted-foreground">
                    Processing fee includes card processing (
                    {STRIPE_TRANSFER_FEE_LABEL}).
                  </p>
                ) : null}
              </div>
            </AccordionContent>
          </AccordionItem>
        </Accordion>
      </div>
    </div>
  );
};
