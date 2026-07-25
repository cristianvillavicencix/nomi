import type { Contact } from "@/components/atomic-crm/types";
import type { Ticket } from "@/modules/types";
import { getTicketClientFirstName } from "@/modules/tickets/ticketRequester";

export const DEFAULT_TICKET_PAYMENT_EMAIL_MESSAGE =
  "Your project deliverables are ready.\n\nPlease pay using the secure link below. Your files will be delivered automatically by email after payment.";

export const DEFAULT_TICKET_PAYMENT_REMINDER_MESSAGE =
  "This is a friendly reminder that your invoice is still unpaid.\n\nPlease pay using the secure link below to complete payment. Your files will be delivered automatically after payment.";

export const resolveTicketPropertyAddress = (ticket: Pick<Ticket, "subject">) =>
  ticket.subject?.trim() || "Your property";

/** @deprecated Prefer buildTicketPaymentCopyFromDeliverables */
export const buildTicketPaymentEmailSubject = (propertyAddress: string) =>
  `Invoice for services (${propertyAddress.trim()})`;

/** @deprecated Prefer buildTicketPaymentReminderCopyFromDeliverables */
export const buildTicketPaymentReminderSubject = (propertyAddress: string) =>
  `Reminder: Invoice for services (${propertyAddress.trim()})`;

/** @deprecated Prefer buildTicketPaymentCopyFromDeliverables */
export const buildTicketDeliveryEmailSubject = (propertyAddress: string) =>
  `Your project files are ready (${propertyAddress.trim()})`;

const escapeHtml = (value: string) =>
  value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

export const buildTicketPaymentEmailHtml = (params: {
  orgName: string;
  invoiceNumber: string;
  amountFormatted: string;
  paymentUrl: string;
  customMessage?: string;
  serviceLines?: string[];
}) => {
  const intro =
    params.customMessage?.trim() || DEFAULT_TICKET_PAYMENT_EMAIL_MESSAGE;
  const introHtml = intro
    .split(/\n\n+/)
    .map((block) => `<p>${escapeHtml(block).replace(/\n/g, "<br>")}</p>`)
    .join("");

  const serviceLines = (params.serviceLines ?? []).filter(Boolean);
  const servicesHtml =
    serviceLines.length > 1
      ? `<div style="margin:16px 0;"><p style="margin:0 0 8px;font-weight:600;">Services included</p><ul style="margin:0;padding-left:20px;">${serviceLines
          .map((line) => `<li style="margin:4px 0;">${escapeHtml(line)}</li>`)
          .join("")}</ul></div>`
      : "";

  return `
    <div style="font-family:system-ui,sans-serif;color:#0f172a;line-height:1.5;max-width:560px;">
      ${introHtml}
      ${servicesHtml}
      <table style="width:100%;border-collapse:collapse;margin:16px 0;">
        <tr><td style="padding:4px 0;color:#64748b;">Invoice</td><td style="padding:4px 0;text-align:right;font-weight:600;">${escapeHtml(params.invoiceNumber)}</td></tr>
        <tr><td style="padding:4px 0;color:#64748b;">Amount due</td><td style="padding:4px 0;text-align:right;font-weight:600;">${escapeHtml(params.amountFormatted)}</td></tr>
      </table>
      <p style="margin:20px 0;"><a href="${escapeHtml(params.paymentUrl)}" style="display:inline-block;background:#2563eb;color:#ffffff;padding:12px 20px;border-radius:8px;text-decoration:none;font-weight:600;">Pay securely</a></p>
      <p style="color:#64748b;font-size:13px;">${escapeHtml(params.orgName)}</p>
    </div>`;
};

export {
  buildTicketPaymentReminderSmsText,
  buildTicketPaymentSmsText,
} from "@/modules/tickets/ticketInvoiceCopy";

export const buildTicketDeliveryEmailHtml = (params: {
  orgName: string;
  invoiceNumber: string;
  propertyAddress: string;
  fileNames: string[];
}) => {
  const filesHtml =
    params.fileNames.length > 0
      ? `<ul style="margin:12px 0;padding-left:20px;">${params.fileNames
          .map((name) => `<li style="margin:4px 0;">${escapeHtml(name)}</li>`)
          .join("")}</ul>`
      : "<p>Your supplement files are attached to this email.</p>";

  return `
    <div style="font-family:system-ui,sans-serif;color:#0f172a;line-height:1.5;max-width:560px;">
      <p>Thank you for your payment (<strong>${escapeHtml(params.invoiceNumber)}</strong>).</p>
      <p>Your supplement files for <strong>${escapeHtml(params.propertyAddress)}</strong> are attached to this email:</p>
      ${filesHtml}
      <p style="color:#64748b;font-size:13px;">${escapeHtml(params.orgName)}</p>
    </div>`;
};

export const buildTicketDeliveryPreviewText = (params: {
  ticket: Ticket;
  contact?: Contact | null;
  invoiceNumber: string;
  fileNames: string[];
}) => {
  const firstName = getTicketClientFirstName(params.ticket, params.contact);
  const propertyAddress = resolveTicketPropertyAddress(params.ticket);
  const fileList =
    params.fileNames.length > 0
      ? params.fileNames.join(", ")
      : "your supplement files";

  return `Hi ${firstName},\n\nThank you for your payment (${params.invoiceNumber}). Your supplement files for ${propertyAddress} are attached: ${fileList}.`;
};

export const buildTicketDeliverySmsText = (params: {
  orgName: string;
  ticket: Ticket;
  contact?: Contact | null;
  invoiceNumber: string;
  fileNames: string[];
}) => {
  const firstName = getTicketClientFirstName(params.ticket, params.contact);
  const propertyAddress = resolveTicketPropertyAddress(params.ticket);
  const fileList =
    params.fileNames.length > 0
      ? params.fileNames.join(", ")
      : "your supplement files";

  return [
    `${params.orgName} here:`,
    firstName ? `Hi ${firstName},` : "Hi,",
    `Thank you for your payment (${params.invoiceNumber}).`,
    `Your supplement files for ${propertyAddress} are ready: ${fileList}.`,
  ].join("\n");
};

export const buildTicketPaymentThankYouSmsText = (params: {
  orgName: string;
  ticket: Ticket;
  contact?: Contact | null;
  invoiceNumber: string;
  amountFormatted: string;
}) => {
  const firstName = getTicketClientFirstName(params.ticket, params.contact);
  const propertyAddress = resolveTicketPropertyAddress(params.ticket);

  return [
    `${params.orgName} here:`,
    firstName ? `Hi ${firstName},` : "Hi,",
    `We received your payment of ${params.amountFormatted} for invoice ${params.invoiceNumber}.`,
    `Your supplement files for ${propertyAddress} will follow shortly.`,
  ].join("\n");
};
