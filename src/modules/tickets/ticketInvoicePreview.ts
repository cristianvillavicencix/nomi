import { newInvoiceLineKey, type InvoiceLineDraft } from "@/modules/billing/invoiceLineUtils";
import type { ClientInvoiceLineItem } from "@/modules/types";
import type { SupplementPricingBreakdown } from "@/modules/tickets/supplementPricing";
import { formatSupplementMoney } from "@/modules/tickets/supplementPricing";

export {
  DEFAULT_TICKET_PAYMENT_EMAIL_MESSAGE,
  DEFAULT_TICKET_PAYMENT_REMINDER_MESSAGE,
  buildTicketDeliveryEmailHtml,
  buildTicketDeliveryEmailSubject,
  buildTicketDeliveryPreviewText,
  buildTicketDeliverySmsText,
  buildTicketPaymentEmailHtml,
  buildTicketPaymentEmailSubject,
  buildTicketPaymentReminderSubject,
  buildTicketPaymentReminderSmsText,
  buildTicketPaymentSmsText,
  buildTicketPaymentThankYouSmsText,
  resolveTicketPropertyAddress,
} from "@/modules/tickets/ticketEmailTemplates";

export {
  buildTicketPaymentCopyFromDeliverables,
  buildTicketPaymentReminderCopyFromDeliverables,
} from "@/modules/tickets/ticketInvoiceCopy";

const addDays = (isoDate: string, days: number) => {
  const date = new Date(`${isoDate}T12:00:00`);
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
};

export const ticketInvoicePreviewDates = (issueDate?: string) => {
  const issue = issueDate ?? new Date().toISOString().slice(0, 10);
  return {
    issueDate: issue,
    dueDate: addDays(issue, 7),
    terms: "Due on receipt",
  };
};

export const supplementPricingToInvoiceLines = (
  pricing: SupplementPricingBreakdown,
): InvoiceLineDraft[] =>
  pricing.lines.map((line, index) => ({
    key: newInvoiceLineKey(),
    title: line.description,
    item_detail: "",
    quantity: line.quantity,
    unit: line.unit,
    unit_price: line.unitPrice,
    sort_order: index,
  }));

const isTransferFeeLineItem = (description?: string | null) =>
  /^transfer fee$/i.test(description?.trim() ?? "");

/** Ticket invoices carry the processing fee in fee_amount only — not as a table row. */
export const filterTicketInvoiceLineItems = <T extends { description?: string | null }>(
  items: T[],
): T[] => items.filter((line) => !isTransferFeeLineItem(line.description));

export const clientInvoiceLineItemsToDrafts = (
  items: ClientInvoiceLineItem[],
): InvoiceLineDraft[] =>
  filterTicketInvoiceLineItems(items).map((line, index) => ({
    key: String(line.id ?? newInvoiceLineKey()),
    title: line.description,
    item_detail: "",
    quantity: Number(line.quantity) || 1,
    unit: line.unit ?? "ea",
    unit_price: Number(line.unit_price) || 0,
    sort_order: line.sort_order ?? index,
  }));

export const formatTicketInvoicePreviewMoney = formatSupplementMoney;
