import { useMemo, type ReactNode } from "react";
import { CheckCircle2, Download, Loader2, Wallet } from "lucide-react";
import type { Company, Contact } from "@/components/atomic-crm/types";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";
import { formatBillingDate } from "@/modules/billing/billingDisplayUtils";
import { formatContactName } from "@/modules/billing/billingUtils";
import {
  STRIPE_TRANSFER_FEE_LABEL,
  type InvoiceLineDraft,
} from "@/modules/billing/invoiceLineUtils";
import { cn } from "@/lib/utils";

const PORTAL_NAVY = "var(--brand-navy)";

const formatMoney = (value: number, currency = "USD") =>
  new Intl.NumberFormat("en-US", { style: "currency", currency }).format(value);

const invoiceStatusLabel = (status?: string) => {
  if (status === "sent") return "Sent";
  if (status === "paid") return "Paid";
  if (status === "draft") return "Draft";
  return status?.replace(/_/g, " ") ?? "Sent";
};

export type PortalInvoiceCompactViewProps = {
  invoiceNumber: string;
  status?: string;
  issueDate: string;
  dueDate: string;
  terms: string;
  company?: Company | null;
  contact?: Contact | null;
  lines: InvoiceLineDraft[];
  termsAndConditions?: string | null;
  subtotal: number;
  discountAmount: number;
  feeAmount: number;
  total: number;
  balanceDue: number;
  currency?: string;
  isPaid: boolean;
  balanceFormatted: string;
  downloading: boolean;
  onPay: () => void;
  onDownload: () => void;
};

export const PortalInvoiceCompactView = ({
  invoiceNumber,
  status,
  issueDate,
  dueDate,
  terms,
  company,
  contact,
  lines,
  termsAndConditions,
  subtotal,
  discountAmount,
  feeAmount,
  balanceDue,
  currency = "USD",
  isPaid,
  balanceFormatted,
  downloading,
  onPay,
  onDownload,
}: PortalInvoiceCompactViewProps) => {
  const contactName = formatContactName(contact);
  const contactEmail =
    contact?.email_jsonb?.find((row) => row.isPrimary)?.email?.trim() ??
    contact?.email_jsonb?.find((row) => row.email?.trim())?.email?.trim() ??
    contact?.email_jsonb?.[0]?.email?.trim();
  const contactPhone =
    contact?.phone_jsonb?.find((row) => row.isPrimary)?.number?.trim() ??
    contact?.phone_jsonb?.find((row) => row.number?.trim())?.number?.trim() ??
    contact?.phone_jsonb?.[0]?.number?.trim();

  const statusLabel = invoiceStatusLabel(status);

  const lineRows = useMemo(
    () =>
      lines.map((line) => ({
        key: line.key,
        title: line.title || "—",
        detail: line.item_detail?.trim(),
        quantity: line.quantity,
        unitPrice: line.unit_price,
        lineTotal: line.quantity * line.unit_price,
      })),
    [lines],
  );

  return (
    <div className="mx-auto w-full max-w-lg md:max-w-2xl">
      <div
        className="rounded-2xl px-5 py-5 text-white shadow-md"
        style={{ backgroundColor: PORTAL_NAVY }}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[11px] font-semibold tracking-[0.14em] text-white/70">
              INVOICE
            </p>
            <p className="truncate text-lg font-semibold tracking-tight">
              {invoiceNumber}
            </p>
          </div>
          <span className="shrink-0 rounded-full bg-white/15 px-2.5 py-1 text-xs font-medium capitalize text-white">
            {statusLabel}
          </span>
        </div>
        <div className="mt-5">
          <p className="text-[11px] font-semibold tracking-[0.14em] text-white/70">
            BALANCE DUE
          </p>
          <p className="text-[2.5rem] font-bold leading-none tabular-nums tracking-tight">
            {balanceFormatted}
          </p>
        </div>
      </div>

      <div className="mt-4 flex items-center gap-2">
        {isPaid ? (
          <span className="inline-flex h-12 flex-1 items-center justify-center gap-2 rounded-xl border border-success/40 bg-success/15 px-4 text-sm font-medium text-success">
            <CheckCircle2 className="size-4 shrink-0" />
            Paid in full
          </span>
        ) : (
          <Button
            type="button"
            className="h-12 flex-1 rounded-xl bg-warning text-base font-semibold text-warning-foreground hover:bg-warning/90"
            onClick={onPay}
          >
            <Wallet className="size-4" />
            Pay now
          </Button>
        )}
        <Button
          type="button"
          variant="outline"
          className="h-12 shrink-0 rounded-xl px-4"
          disabled={downloading}
          onClick={onDownload}
          aria-label="Download invoice PDF"
        >
          {downloading ? (
            <Loader2 className="size-5 animate-spin" />
          ) : (
            <Download className="size-5" />
          )}
        </Button>
      </div>

      <div className="mt-4 rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm">
        <div className="grid grid-cols-3 gap-3 border-b border-slate-100 pb-5">
          <MetaCell label="Issue date" value={formatBillingDate(issueDate)} />
          <MetaCell label="Terms" value={terms} />
          <MetaCell label="Due date" value={formatBillingDate(dueDate)} />
        </div>

        <section className="mt-5">
          <SectionLabel>Bill to</SectionLabel>
          {company?.name ? (
            <p className="mt-2 text-sm font-semibold text-brand">{company.name}</p>
          ) : null}
          {contactName ? (
            <p className="mt-1 text-sm text-slate-800">{contactName}</p>
          ) : null}
          {contactEmail ? (
            <p className="mt-0.5 text-sm text-slate-600">{contactEmail}</p>
          ) : null}
          {contactPhone ? (
            <p className="mt-0.5 text-sm text-slate-600">{contactPhone}</p>
          ) : null}
          {!company?.name && !contactName ? (
            <p className="mt-2 text-sm text-slate-400">—</p>
          ) : null}
        </section>

        <section className="mt-6">
          <SectionLabel>Items</SectionLabel>
          <div className="mt-3 space-y-3">
            {lineRows.length === 0 ? (
              <p className="rounded-xl border border-dashed px-4 py-6 text-center text-sm text-slate-400">
                No line items
              </p>
            ) : (
              lineRows.map((line) => (
                <div
                  key={line.key}
                  className="rounded-xl border border-slate-200 bg-slate-50/40 p-4"
                >
                  <div className="flex items-start justify-between gap-3">
                    <p className="min-w-0 text-sm font-semibold text-slate-900">
                      {line.title}
                    </p>
                    <p className="shrink-0 text-sm font-semibold tabular-nums text-slate-900">
                      {formatMoney(line.lineTotal, currency)}
                    </p>
                  </div>
                  {line.detail ? (
                    <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-slate-600">
                      {line.detail}
                    </p>
                  ) : null}
                  <p className="mt-2 text-xs tabular-nums text-slate-500">
                    Qty {line.quantity.toFixed(2)} × {formatMoney(line.unitPrice, currency)}
                  </p>
                </div>
              ))
            )}
          </div>
        </section>

        <section className="mt-6 space-y-2 border-t border-slate-100 pt-4 text-sm">
          <TotalRow label="Sub total" value={formatMoney(subtotal, currency)} />
          {discountAmount > 0 ? (
            <TotalRow
              label="Discount"
              value={`-${formatMoney(discountAmount, currency)}`}
              valueClassName="text-red-600"
            />
          ) : null}
          {feeAmount > 0 ? (
            <TotalRow
              label={
                <>
                  Transfer fee
                  <span className="ml-1 text-xs font-normal text-slate-400">
                    ({STRIPE_TRANSFER_FEE_LABEL})
                  </span>
                </>
              }
              value={formatMoney(feeAmount, currency)}
            />
          ) : null}
          <TotalRow
            label="Balance due"
            value={formatMoney(balanceDue, currency)}
            emphasis
          />
        </section>

        {termsAndConditions?.trim() ? (
          <Accordion type="single" collapsible className="mt-2 border-t border-slate-100">
            <AccordionItem value="terms" className="border-0">
              <AccordionTrigger className="py-4 text-sm font-medium text-slate-800 hover:no-underline">
                Terms & Conditions
              </AccordionTrigger>
              <AccordionContent className="pb-2 text-sm leading-relaxed text-slate-600">
                <p className="whitespace-pre-line">{termsAndConditions.trim()}</p>
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        ) : null}
      </div>
    </div>
  );
};

const SectionLabel = ({ children }: { children: ReactNode }) => (
  <p className="text-[10px] font-semibold tracking-[0.14em] text-slate-400 uppercase">
    {children}
  </p>
);

const MetaCell = ({ label, value }: { label: string; value: string }) => (
  <div className="min-w-0">
    <p className="text-[10px] font-semibold tracking-[0.12em] text-slate-400 uppercase">
      {label}
    </p>
    <p className="mt-1 text-sm font-medium text-slate-800">{value}</p>
  </div>
);

const TotalRow = ({
  label,
  value,
  emphasis = false,
  valueClassName,
}: {
  label: ReactNode;
  value: string;
  emphasis?: boolean;
  valueClassName?: string;
}) => (
  <div className="flex items-center justify-between gap-4">
    <span
      className={cn(
        "text-slate-600",
        emphasis && "text-base font-semibold text-slate-900",
      )}
    >
      {label}
    </span>
    <span
      className={cn(
        "tabular-nums",
        emphasis
          ? "text-base font-bold text-brand"
          : "font-medium text-slate-900",
        valueClassName,
      )}
    >
      {value}
    </span>
  </div>
);
