import {
  newInvoiceLineKey,
  type InvoiceLineDraft,
} from "@/modules/billing/invoiceLineUtils";
import type {
  ClientInvoice,
  ClientInvoiceLineItem,
  TicketDeliverable,
} from "@/modules/types";
import type { SupplementPricingBreakdown } from "@/modules/tickets/supplementPricing";
import { formatSupplementMoney } from "@/modules/tickets/supplementPricing";
import {
  buildTicketDeliveryEmailHtml,
  buildTicketPaymentEmailHtml,
  buildTicketPaymentSmsText,
} from "@/modules/tickets/ticketEmailTemplates";
import { resolveTicketSmsServiceSubject } from "@/modules/tickets/ticketInvoiceCopy";

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
  resolveTicketSmsServiceSubject,
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
export const filterTicketInvoiceLineItems = <
  T extends { description?: string | null },
>(
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

const filterUnbilledDeliverables = (deliverables: TicketDeliverable[]) =>
  deliverables.filter((file) => !file.invoiced_invoice_id);

export type TicketInvoiceSendEmailPreviews = {
  paymentEmailHtml: string;
  paymentSmsText: string;
  deliveryEmailHtml: string;
  amountFormatted: string;
  fileCount: number;
};

/** Shared payment + delivery preview HTML for single and combined ticket invoice send dialogs. */
export const buildTicketInvoiceSendEmailPreviews = (params: {
  draftInvoice: ClientInvoice | null;
  paymentUrl: string;
  organizationName: string;
  emailMessage: string;
  serviceLines: string[];
  propertyAddress: string;
  deliverables: TicketDeliverable[];
  contactFirstName?: string | null;
  unbilledOnly?: boolean;
}): TicketInvoiceSendEmailPreviews => {
  const {
    draftInvoice,
    paymentUrl,
    organizationName,
    emailMessage,
    serviceLines,
    propertyAddress,
    deliverables,
    contactFirstName,
    unbilledOnly = true,
  } = params;

  const previewFiles = unbilledOnly
    ? filterUnbilledDeliverables(deliverables)
    : deliverables;

  const amountFormatted = draftInvoice
    ? formatTicketInvoicePreviewMoney(Number(draftInvoice.amount) || 0)
    : "—";

  const paymentEmailHtml =
    draftInvoice && paymentUrl
      ? buildTicketPaymentEmailHtml({
          orgName: organizationName,
          invoiceNumber: draftInvoice.invoice_number,
          amountFormatted,
          paymentUrl,
          customMessage: emailMessage,
          serviceLines,
        })
      : "";

  const paymentSmsText =
    draftInvoice && paymentUrl
      ? buildTicketPaymentSmsText({
          orgName: organizationName,
          paymentUrl,
          recipientFirstName: contactFirstName,
          serviceSubject: resolveTicketSmsServiceSubject(
            previewFiles,
            propertyAddress,
          ),
        })
      : "";

  const deliveryEmailHtml = draftInvoice
    ? buildTicketDeliveryEmailHtml({
        orgName: organizationName,
        invoiceNumber: draftInvoice.invoice_number,
        propertyAddress,
        fileNames: previewFiles.map((file) => file.title),
      })
    : "";

  return {
    paymentEmailHtml,
    paymentSmsText,
    deliveryEmailHtml,
    amountFormatted,
    fileCount: previewFiles.length,
  };
};
