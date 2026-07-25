import { CreditCard, Package2 } from "lucide-react";
import {
  lineItemsToInvoiceDrafts,
  STRIPE_TRANSFER_FEE_LABEL,
} from "@/modules/billing/invoiceLineUtils";
import type { PublicInvoicePayload } from "@/modules/billing/public/publicInvoiceApi";
import {
  buildPublicInvoiceDeliveryReadyMessage,
  formatPublicInvoiceLineTitle,
  type PublicInvoiceDeliveryInfo,
} from "@/modules/billing/public/publicInvoiceDeliveryMessage";
import { PRODUCT_MARK_SRC, PRODUCT_NAME } from "@/lib/branding";
import { cn } from "@/lib/utils";

const formatMoney = (value: number, currency = "USD") =>
  new Intl.NumberFormat("en-US", { style: "currency", currency }).format(value);

const formatDueBadge = (dueDate: string) => {
  const parsed = new Date(`${dueDate}T12:00:00`);
  if (Number.isNaN(parsed.getTime())) return `Due ${dueDate}`;
  return `Due ${parsed.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  })}`;
};

const buildBillToLine = (payload: PublicInvoicePayload) => {
  const { contact_name: contact, company_name: company } = payload.bill_to;
  if (contact && company) return `Billed to ${contact} · ${company}`;
  if (contact) return `Billed to ${contact}`;
  if (company) return `Billed to ${company}`;
  return null;
};

export const PublicInvoicePaymentSummary = ({
  payload,
  balanceDue,
  balanceDueFormatted,
  className,
}: {
  payload: PublicInvoicePayload;
  balanceDue: number;
  balanceDueFormatted: string;
  className?: string;
}) => {
  const { invoice, line_items, organization, delivery } = payload;
  const currency = invoice.currency ?? "USD";
  const feeAmount = Number(invoice.fee_amount) || 0;
  const total = Number(invoice.amount) || 0;
  const lines = lineItemsToInvoiceDrafts(line_items);
  const billToLine = buildBillToLine(payload);
  const deliveryInfo = delivery as PublicInvoiceDeliveryInfo | null | undefined;
  const deliveryMessage = deliveryInfo
    ? buildPublicInvoiceDeliveryReadyMessage(deliveryInfo)
    : null;

  return (
    <div className={cn("divide-y divide-border/50", className)}>
      <header className="flex items-start justify-between gap-3 px-4 pb-4 pt-5 sm:px-6 sm:pt-6">
        <div className="flex min-w-0 items-start gap-3">
          <img
            src={PRODUCT_MARK_SRC}
            alt={PRODUCT_NAME}
            className="size-10 shrink-0 rounded-lg object-contain"
          />
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-foreground">
              {organization.name}
            </p>
            <p className="truncate text-sm text-muted-foreground">
              Invoice {invoice.invoice_number}
            </p>
          </div>
        </div>
        <span className="shrink-0 rounded-full bg-amber-100 px-2.5 py-1 text-xs font-medium text-amber-900">
          {formatDueBadge(invoice.due_date)}
        </span>
      </header>

      <section className="px-4 py-5 text-center sm:px-6">
        <p className="text-sm text-muted-foreground">Amount due</p>
        <p className="mt-1 text-[2rem] font-bold tabular-nums leading-none tracking-tight text-foreground sm:text-[2.25rem]">
          {balanceDueFormatted}
        </p>
        {billToLine ? (
          <p className="mt-3 text-sm text-muted-foreground">{billToLine}</p>
        ) : null}
      </section>

      <section className="space-y-3 px-4 py-5 sm:px-6">
        {lines.map((line) => {
          const lineTotal = line.quantity * line.unit_price;
          const title = formatPublicInvoiceLineTitle(line.title);
          const subtext = line.item_detail?.trim() || null;

          return (
            <div
              key={line.key}
              className="flex items-start justify-between gap-3"
            >
              <div className="min-w-0">
                <p className="text-sm font-semibold text-foreground">{title}</p>
                {subtext ? (
                  <p className="mt-0.5 text-sm text-muted-foreground">
                    {subtext}
                  </p>
                ) : null}
              </div>
              <p className="shrink-0 text-sm font-medium tabular-nums text-foreground">
                {formatMoney(lineTotal, currency)}
              </p>
            </div>
          );
        })}

        {feeAmount > 0 ? (
          <div className="flex items-start justify-between gap-3">
            <p className="text-sm text-foreground">Processing fee</p>
            <p className="shrink-0 text-sm font-medium tabular-nums text-foreground">
              {formatMoney(feeAmount, currency)}
            </p>
          </div>
        ) : null}

        <div className="flex items-start justify-between gap-3 border-t border-border/40 pt-3">
          <p className="text-sm font-semibold text-foreground">Total</p>
          <p className="shrink-0 text-sm font-semibold tabular-nums text-foreground">
            {formatMoney(total, currency)}
          </p>
        </div>

        {feeAmount > 0 ? (
          <p className="text-xs text-muted-foreground">
            Processing fee includes card processing ({STRIPE_TRANSFER_FEE_LABEL}
            ).
          </p>
        ) : null}
      </section>

      {deliveryMessage ? (
        <section className="px-4 py-4 sm:px-6">
          <div className="flex gap-3 rounded-xl border border-info/30 bg-info/10 px-4 py-3 text-foreground">
            <Package2
              className="mt-0.5 size-5 shrink-0 text-info"
              aria-hidden
            />
            <div>
              <p className="text-sm font-semibold">Your files are ready</p>
              <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                {deliveryMessage}
              </p>
            </div>
          </div>
        </section>
      ) : null}
    </div>
  );
};

export const PublicInvoicePaymentCardHeading = ({
  className,
}: {
  className?: string;
}) => (
  <p
    className={cn(
      "mb-2 flex items-center gap-2 text-sm font-semibold text-foreground",
      className,
    )}
  >
    <CreditCard className="size-4 text-muted-foreground" aria-hidden />
    Card details
  </p>
);
