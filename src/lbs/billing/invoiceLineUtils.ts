export type InvoiceLineDraft = {
  key: string;
  /** Line item title (catalog name or custom). */
  title: string;
  /** Optional detail text shown under the title on the invoice. */
  item_detail?: string;
  quantity: number;
  unit: string;
  unit_price: number;
  package_id?: number | null;
  addon_id?: number | null;
  sort_order: number;
};

/** @deprecated Use title + item_detail; kept for API payload building. */
export const formatLineItemDescription = (line: InvoiceLineDraft) => {
  const title = line.title.trim();
  const detail = line.item_detail?.trim();
  if (title && detail) return `${title}\n${detail}`;
  return title || detail || "";
};

export const invoiceLineTotal = (quantity: number, unitPrice: number) =>
  Math.round(quantity * unitPrice * 100) / 100;

/** Stripe-style processing fee passed through to the client. */
export const STRIPE_TRANSFER_FEE_RATE = 0.029;
export const STRIPE_TRANSFER_FEE_FIXED = 0.3;
export const STRIPE_TRANSFER_FEE_LABEL = "2.9% + $0.30";

export const calculateTransferFee = (subtotal: number) =>
  Math.round((subtotal * STRIPE_TRANSFER_FEE_RATE + STRIPE_TRANSFER_FEE_FIXED) * 100) /
  100;

export const calculateInvoiceTotals = (
  lines: InvoiceLineDraft[],
  discountPercent = 0,
) => {
  const subtotal = lines.reduce(
    (sum, line) => sum + invoiceLineTotal(line.quantity, line.unit_price),
    0,
  );
  const percent = Math.min(
    Math.max(Number(discountPercent) || 0, 0),
    100,
  );
  const discount =
    Math.round(subtotal * (percent / 100) * 100) / 100;
  const discountedSubtotal =
    Math.round((subtotal - discount) * 100) / 100;
  const feeAmount =
    discountedSubtotal > 0 ? calculateTransferFee(discountedSubtotal) : 0;
  const total = Math.round((discountedSubtotal + feeAmount) * 100) / 100;
  return {
    subtotal,
    discountPercent: percent,
    discountAmount: discount,
    discountedSubtotal,
    feeAmount,
    total,
  };
};

/** Reverse stored flat discount into the editor percentage field. */
export const discountPercentFromAmount = (
  subtotal: number,
  discountAmount: number,
) => {
  if (!subtotal || !discountAmount) return 0;
  return Math.round((discountAmount / subtotal) * 10000) / 100;
};

export const defaultInvoiceDescription = (lines: InvoiceLineDraft[]) => {
  const valid = lines.filter((line) => line.title.trim());
  if (!valid.length) return "Invoice";
  if (valid.length === 1) return formatLineItemDescription(valid[0]);
  return `${valid[0].title} + ${valid.length - 1} more`;
};

export const addDaysIso = (isoDate: string, days: number) => {
  const date = new Date(`${isoDate}T12:00:00`);
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
};

export const dueDateFromTerms = (issueDate: string, terms: string) => {
  const match = /net\s*(\d+)/i.exec(terms);
  const days = match ? Number(match[1]) : 30;
  return addDaysIso(issueDate, Number.isFinite(days) ? days : 30);
};

export const newInvoiceLineKey = () =>
  `inv-line-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

export const TERMS_OPTIONS = [
  "Net 5",
  "Net 15",
  "Net 30",
  "Due on receipt",
] as const;

/** Shown on new invoices until the sequential number is assigned on save. */
export const DRAFT_INVOICE_NUMBER_LABEL = "Draft";

/** Map persisted line items back to editor drafts (e.g. invoice show view). */
export const lineItemsToInvoiceDrafts = (
  items: Array<{
    id?: unknown;
    description: string;
    quantity: number;
    unit?: string | null;
    unit_price: number;
    sort_order?: number | null;
  }>,
): InvoiceLineDraft[] =>
  items.map((item, index) => {
    const [title, ...detailParts] = item.description.split("\n");
    return {
      key: String(item.id ?? index),
      title: title ?? "",
      item_detail: detailParts.join("\n"),
      quantity: Number(item.quantity) || 0,
      unit: item.unit?.trim() || "ea",
      unit_price: Number(item.unit_price) || 0,
      sort_order: item.sort_order ?? index,
    };
  });

/** Default footer copy shown on new standalone invoices (stored in client_invoices.notes). */
export const DEFAULT_INVOICE_TERMS_AND_CONDITIONS = `Payment is due by the due date listed above. Late payments may be subject to additional fees.

This invoice covers only the services and deliverables listed above. Work begins upon receipt of payment unless otherwise agreed in writing.

Questions about this invoice must be submitted within 7 days of receipt. By remitting payment, the client agrees to the service terms on file with the provider.`;
