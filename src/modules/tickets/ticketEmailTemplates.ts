import type { Contact } from "@/components/atomic-crm/types";
import type { Ticket } from "@/modules/types";
import { getTicketClientFirstName } from "@/modules/tickets/ticketRequester";

export const DEFAULT_TICKET_PAYMENT_EMAIL_MESSAGE =
  "Your Xactimate supplement is ready.\n\nPlease pay using the secure link below. Your files will be delivered automatically by email after payment.";

export const DEFAULT_TICKET_PAYMENT_REMINDER_MESSAGE =
  "This is a friendly reminder that your supplement invoice is still unpaid.\n\nPlease use the secure link below to complete payment. Your files will be delivered automatically after payment.";

export const resolveTicketPropertyAddress = (ticket: Pick<Ticket, "subject">) =>
  ticket.subject?.trim() || "Your property";

export const buildTicketPaymentEmailSubject = (propertyAddress: string) =>
  `Invoice and Supplements Ready (${propertyAddress.trim()})`;

export const buildTicketPaymentReminderSubject = (propertyAddress: string) =>
  `Reminder: Invoice and Supplements Ready (${propertyAddress.trim()})`;

export const buildTicketDeliveryEmailSubject = (propertyAddress: string) =>
  `Your Supplement Files Are Ready (${propertyAddress.trim()})`;

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
}) => {
  const intro =
    params.customMessage?.trim() || DEFAULT_TICKET_PAYMENT_EMAIL_MESSAGE;
  const introHtml = intro
    .split(/\n\n+/)
    .map((block) => `<p>${escapeHtml(block).replace(/\n/g, "<br>")}</p>`)
    .join("");

  return `
    <div style="font-family:system-ui,sans-serif;color:#0f172a;line-height:1.5;max-width:560px;">
      ${introHtml}
      <table style="width:100%;border-collapse:collapse;margin:16px 0;">
        <tr><td style="padding:4px 0;color:#64748b;">Invoice</td><td style="padding:4px 0;text-align:right;font-weight:600;">${escapeHtml(params.invoiceNumber)}</td></tr>
        <tr><td style="padding:4px 0;color:#64748b;">Amount due</td><td style="padding:4px 0;text-align:right;font-weight:600;">${escapeHtml(params.amountFormatted)}</td></tr>
      </table>
      <p style="margin:20px 0;"><a href="${escapeHtml(params.paymentUrl)}" style="display:inline-block;background:#2563eb;color:#ffffff;padding:12px 20px;border-radius:8px;text-decoration:none;font-weight:600;">Pay securely</a></p>
      <p style="color:#64748b;font-size:13px;">${escapeHtml(params.orgName)}</p>
    </div>`;
};

export const buildTicketPaymentSmsText = (params: {
  orgName: string;
  invoiceNumber: string;
  amountFormatted: string;
  dueDateFormatted: string;
  paymentUrl: string;
  contact?: Contact | null;
  senderFirstName?: string | null;
}) => {
  const greetingName = params.contact?.first_name?.trim() || null;
  const sender = params.senderFirstName?.trim().split(/\s+/)[0] ?? null;
  const intro = sender
    ? `This is ${sender} from ${params.orgName}:`
    : `${params.orgName} here:`;

  return [
    intro,
    greetingName ? `Hi ${greetingName},` : "Hi,",
    `Invoice ${params.invoiceNumber} for ${params.amountFormatted} is due ${params.dueDateFormatted}.`,
    `Pay securely: ${params.paymentUrl}`,
  ].join("\n");
};

export const buildTicketPaymentReminderSmsText = (params: {
  orgName: string;
  invoiceNumber: string;
  amountFormatted: string;
  dueDateFormatted: string;
  paymentUrl: string;
  contact?: Contact | null;
  senderFirstName?: string | null;
}) => {
  const greetingName = params.contact?.first_name?.trim() || null;
  const sender = params.senderFirstName?.trim().split(/\s+/)[0] ?? null;
  const intro = sender
    ? `This is ${sender} from ${params.orgName}:`
    : `${params.orgName} here:`;

  return [
    intro,
    greetingName ? `Hi ${greetingName},` : "Hi,",
    `Reminder: invoice ${params.invoiceNumber} for ${params.amountFormatted} is still due ${params.dueDateFormatted}.`,
    `Pay securely: ${params.paymentUrl}`,
  ].join("\n");
};

export const buildTicketDeliveryEmailHtml = (params: {
  orgName: string;
  invoiceNumber: string;
  propertyAddress: string;
  fileNames: string[];
}) => {
  const filesHtml =
    params.fileNames.length > 0
      ? `<ul style="margin:12px 0;padding-left:20px;">${params.fileNames
          .map(
            (name) =>
              `<li style="margin:4px 0;">${escapeHtml(name)}</li>`,
          )
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
