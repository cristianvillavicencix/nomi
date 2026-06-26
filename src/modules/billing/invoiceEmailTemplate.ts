import { formatContactName } from "@/modules/billing/billingUtils";
import {
  buildInvoicePaymentSchedule,
  computeInvoiceBalanceDue,
  invoicePaymentModeFromRecord,
} from "@/modules/billing/invoicePaymentUtils";
import type { ClientInvoice, ClientInvoiceLineItem } from "@/modules/types";
import type { Company, Contact } from "@/components/atomic-crm/types";
import type { InvoiceRemainderScheduleConfig } from "@/modules/billing/invoiceRemainderSchedule";
import {
  buildInvoiceOrganizationEmailTagline,
  resolveInvoiceOrganizationName,
} from "@/modules/billing/invoiceOrganizationInfo";

export {
  INVOICE_ORGANIZATION_NAME,
  resolveInvoiceOrganizationName,
} from "@/modules/billing/invoiceOrganizationInfo";

export const formatInvoiceMoney = (amount: number, currency = "USD") =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: currency || "USD",
  }).format(Number(amount) || 0);

export const formatInvoiceDueDate = (dueDate: string) => {
  const parsed = new Date(`${dueDate}T12:00:00`);
  if (Number.isNaN(parsed.getTime())) return dueDate;
  return parsed.toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
};

export const resolveClientInvoiceShareUrl = (
  result: { url: string; short_url?: string | null },
  origin = typeof window !== "undefined" ? window.location.origin : "",
) => {
  const candidate = result.short_url?.trim() || result.url?.trim() || "";
  if (!candidate) return "";
  return candidate.startsWith("http") ? candidate : `${origin}${candidate}`;
};

/** Opens the public invoice portal directly on Stripe payment entry. */
export const withInvoicePaymentQuery = (url: string) => {
  if (!url) return url;
  if (/[?&]pay=1(?:&|$)/.test(url)) return url;
  return `${url}${url.includes("?") ? "&" : "?"}pay=1`;
};

export const buildDefaultInvoiceEmailSubject = (
  invoice: ClientInvoice,
  organizationName: string,
) => `${organizationName}: Invoice ${invoice.invoice_number}`;

const splitLineDescription = (description: string) => {
  const parts = description
    .split("\n")
    .map((part) => part.trim())
    .filter(Boolean);
  return {
    title: parts[0] ?? description,
    detail: parts.length > 1 ? parts.slice(1).join(" ") : null,
  };
};

const escapeHtml = (value: string) =>
  value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

export type InvoiceEmailTemplateContext = {
  invoice: ClientInvoice;
  lineItems: ClientInvoiceLineItem[];
  organizationName: string;
  paymentUrl: string;
  contact?: Contact | null;
  organizationTagline?: string | null;
};

export const buildInvoiceEmailPlainText = ({
  invoice,
  organizationName,
  paymentUrl,
  contact,
  lineItems,
  organizationTagline,
}: InvoiceEmailTemplateContext) => {
  const recipientName = formatContactName(contact);
  const greeting = recipientName ? `Hi ${recipientName},` : "Hi,";
  const amount = formatInvoiceMoney(invoice.amount, invoice.currency);
  const dueDate = formatInvoiceDueDate(invoice.due_date);
  const balanceDue = computeInvoiceBalanceDue(
    Number(invoice.amount) || 0,
    Number(invoice.amount_paid) || 0,
  );

  const lines = [
    greeting,
    "",
    "Thank you for your business. Your invoice is ready — a PDF copy is attached for your records.",
    "",
    `Invoice ${invoice.invoice_number}`,
    `Amount due: ${amount}`,
    `Due date: ${dueDate}`,
    "",
    ...lineItems.map((line) => {
      const { title, detail } = splitLineDescription(line.description);
      return `- ${title}${detail ? ` (${detail})` : ""}: ${formatInvoiceMoney(line.line_total, invoice.currency)}`;
    }),
    "",
    `Subtotal: ${formatInvoiceMoney(Number(invoice.subtotal) || 0, invoice.currency)}`,
    Number(invoice.fee_amount) > 0
      ? `Processing fee: ${formatInvoiceMoney(Number(invoice.fee_amount) || 0, invoice.currency)}`
      : null,
    `Total: ${amount}`,
    "",
    `Pay ${formatInvoiceMoney(balanceDue, invoice.currency)}: ${paymentUrl}`,
    "",
    "Questions about this invoice? Reply to this email and we'll be happy to help.",
    "",
    organizationName,
    organizationTagline,
  ].filter((line): line is string => line !== null && line !== undefined);

  return lines.join("\n");
};

export const buildInvoiceSmsText = ({
  invoice,
  organizationName,
  paymentUrl,
  contact,
  senderFirstName,
}: {
  invoice: ClientInvoice;
  organizationName: string;
  paymentUrl: string;
  contact?: Contact | null;
  senderFirstName?: string | null;
}) => {
  const recipientName = formatContactName(contact);
  const greetingName = recipientName ? recipientName.split(" ")[0] : null;
  const balanceDue = computeInvoiceBalanceDue(
    Number(invoice.amount) || 0,
    Number(invoice.amount_paid) || 0,
  );
  const amount = formatInvoiceMoney(balanceDue, invoice.currency);
  const dueDate = formatInvoiceDueDate(invoice.due_date);
  const sender = senderFirstName?.trim().split(/\s+/)[0] ?? null;
  const intro = sender
    ? `This is ${sender} from ${organizationName}:`
    : `${organizationName} here:`;

  return [
    greetingName ? `Hi ${greetingName},` : "Hi,",
    intro,
    `Your invoice ${invoice.invoice_number} is ready — ${amount} due ${dueDate}.`,
    `Pay: ${paymentUrl}`,
    "",
    "Thank you for your trust.",
  ].join("\n");
};

const formatScheduleLabel = (
  row: { key: string; label: string; timing: string },
  upfrontPercent: number,
) => {
  if (row.key === "deposit" && row.timing === "now") {
    return `Deposit due now (${upfrontPercent}%)`;
  }
  if (row.key === "remainder" || row.key.startsWith("remainder-")) {
    return row.key === "remainder" ? "Remaining balance" : row.label;
  }
  return row.label;
};

export const buildInvoiceEmailHtml = ({
  invoice,
  lineItems,
  organizationName,
  paymentUrl,
  contact,
  organizationTagline,
}: InvoiceEmailTemplateContext) => {
  const recipientName = formatContactName(contact);
  const greetingName = recipientName ? recipientName.split(" ")[0] : "there";
  const currency = invoice.currency ?? "USD";
  const total = Number(invoice.amount) || 0;
  const subtotal = Number(invoice.subtotal) || 0;
  const feeAmount = Number(invoice.fee_amount) || 0;
  const discountAmount = Number(invoice.discount_amount) || 0;
  const balanceDue = computeInvoiceBalanceDue(
    total,
    Number(invoice.amount_paid) || 0,
  );
  const upfrontPercent = Number(invoice.upfront_percent ?? 100);
  const paymentMode = invoicePaymentModeFromRecord(invoice);
  const scheduleRows = buildInvoicePaymentSchedule({
    total,
    amountPaid: Number(invoice.amount_paid) || 0,
    upfrontPercent,
    autoChargeRemainder: invoice.auto_charge_remainder === true,
    saveCard: invoice.save_card_for_future_charges === true,
    dueDate: invoice.due_date,
    issueDate: invoice.issue_date,
    remainderSchedule:
      (invoice.remainder_schedule as InvoiceRemainderScheduleConfig | null) ??
      null,
  });

  const lineRowsHtml = lineItems
    .map((line) => {
      const { title, detail } = splitLineDescription(line.description);
      return `
        <tr>
          <td style="padding:12px 0;border-bottom:1px solid #e5e5e5;vertical-align:top;">
            <div style="font-size:14px;color:#111111;line-height:1.45;">${escapeHtml(title)}</div>
            ${
              detail
                ? `<div style="font-size:12px;color:#737373;margin-top:3px;line-height:1.45;">${escapeHtml(detail)}</div>`
                : ""
            }
          </td>
          <td style="padding:12px 0;border-bottom:1px solid #e5e5e5;text-align:right;vertical-align:top;font-size:14px;color:#111111;white-space:nowrap;">
            ${escapeHtml(formatInvoiceMoney(line.line_total, currency))}
          </td>
        </tr>`;
    })
    .join("");

  const totalsHtml = [
    discountAmount > 0
      ? `<tr><td style="padding:4px 0;font-size:13px;color:#737373;">Discount</td><td style="padding:4px 0;text-align:right;font-size:13px;color:#111111;">-${escapeHtml(formatInvoiceMoney(discountAmount, currency))}</td></tr>`
      : "",
    `<tr><td style="padding:4px 0;font-size:13px;color:#737373;">Subtotal</td><td style="padding:4px 0;text-align:right;font-size:13px;color:#111111;">${escapeHtml(formatInvoiceMoney(subtotal, currency))}</td></tr>`,
    feeAmount > 0
      ? `<tr><td style="padding:4px 0;font-size:13px;color:#737373;">Processing fee</td><td style="padding:4px 0;text-align:right;font-size:13px;color:#111111;">${escapeHtml(formatInvoiceMoney(feeAmount, currency))}</td></tr>`
      : "",
    `<tr><td style="padding:10px 0 0;border-top:1px solid #111111;font-size:14px;font-weight:600;color:#111111;">Total</td><td style="padding:10px 0 0;border-top:1px solid #111111;text-align:right;font-size:14px;font-weight:600;color:#111111;">${escapeHtml(formatInvoiceMoney(total, currency))}</td></tr>`,
  ].join("");

  const showSchedule =
    paymentMode === "deposit_auto" &&
    scheduleRows.some(
      (row) =>
        row.key === "deposit" ||
        row.key === "remainder" ||
        row.key.startsWith("remainder-"),
    );

  const scheduleHtml = showSchedule
    ? `
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin-top:20px;border:1px solid #e5e5e5;">
        <tr>
          <td style="padding:14px 18px;border-bottom:1px solid #e5e5e5;">
            <div style="font-size:11px;font-weight:600;color:#111111;text-transform:uppercase;letter-spacing:0.08em;">Payment schedule</div>
          </td>
        </tr>
        <tr>
          <td style="padding:12px 18px 14px;">
            ${scheduleRows
              .filter((row) => row.timing !== "paid")
              .map(
                (row) => `
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin:4px 0;">
                <tr>
                  <td style="font-size:13px;color:#404040;line-height:1.5;">${escapeHtml(formatScheduleLabel(row, upfrontPercent))}</td>
                  <td style="font-size:13px;font-weight:500;color:#111111;text-align:right;white-space:nowrap;">${escapeHtml(formatInvoiceMoney(row.amount, currency))}</td>
                </tr>
              </table>`,
              )
              .join("")}
            ${
              invoice.auto_charge_remainder
                ? `<div style="padding-top:10px;margin-top:8px;border-top:1px solid #e5e5e5;font-size:12px;color:#737373;line-height:1.5;">Remaining balance is charged automatically on the dates above.</div>`
                : ""
            }
          </td>
        </tr>
      </table>`
    : "";

  const payLabel = formatInvoiceMoney(balanceDue, currency);
  const tagline =
    organizationTagline?.trim() || buildInvoiceOrganizationEmailTagline();

  return `<!DOCTYPE html>
<html lang="en">
<body style="margin:0;padding:0;background:#fafafa;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#fafafa;padding:32px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="600" cellspacing="0" cellpadding="0" style="max-width:600px;width:100%;background:#ffffff;border:1px solid #e5e5e5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
          <tr>
            <td style="padding:28px 32px 24px;border-bottom:1px solid #111111;">
              <div style="font-size:11px;font-weight:600;color:#737373;text-transform:uppercase;letter-spacing:0.1em;margin-bottom:8px;">Invoice</div>
              <div style="font-size:22px;font-weight:600;color:#111111;letter-spacing:-0.02em;">${escapeHtml(organizationName)}</div>
            </td>
          </tr>
          <tr>
            <td style="padding:28px 32px 0;">
              <div style="font-size:18px;font-weight:600;color:#111111;margin-bottom:10px;">${escapeHtml(invoice.invoice_number)}</div>
              <div style="font-size:14px;line-height:1.65;color:#404040;">Hi ${escapeHtml(greetingName)}, thank you for your business. Your invoice is ready — a PDF copy is attached for your records.</div>
            </td>
          </tr>
          <tr>
            <td style="padding:24px 32px 0;">
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border:1px solid #e5e5e5;">
                <tr>
                  <td style="padding:18px 20px;width:50%;vertical-align:top;border-right:1px solid #e5e5e5;">
                    <div style="font-size:11px;color:#737373;text-transform:uppercase;letter-spacing:0.08em;margin-bottom:6px;">Amount due</div>
                    <div style="font-size:26px;font-weight:600;color:#111111;letter-spacing:-0.02em;">${escapeHtml(formatInvoiceMoney(balanceDue, currency))}</div>
                  </td>
                  <td style="padding:18px 20px;width:50%;vertical-align:top;">
                    <div style="font-size:11px;color:#737373;text-transform:uppercase;letter-spacing:0.08em;margin-bottom:6px;">Due date</div>
                    <div style="font-size:16px;font-weight:600;color:#111111;">${escapeHtml(formatInvoiceDueDate(invoice.due_date))}</div>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td style="padding:28px 32px 0;">
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                <tr>
                  <td style="border-bottom:1px solid #111111;padding-bottom:8px;font-size:11px;font-weight:600;color:#111111;text-transform:uppercase;letter-spacing:0.08em;">Description</td>
                  <td style="border-bottom:1px solid #111111;padding-bottom:8px;font-size:11px;font-weight:600;color:#111111;text-transform:uppercase;letter-spacing:0.08em;text-align:right;">Amount</td>
                </tr>
                ${lineRowsHtml}
              </table>
            </td>
          </tr>
          <tr>
            <td style="padding:16px 32px 0;">
              <table role="presentation" cellspacing="0" cellpadding="0" align="right" style="width:260px;max-width:100%;">
                ${totalsHtml}
              </table>
            </td>
          </tr>
          ${
            showSchedule
              ? `<tr><td style="padding:0 32px;">${scheduleHtml}</td></tr>`
              : ""
          }
          <tr>
            <td style="padding:32px 32px 12px;text-align:center;">
              <a href="${escapeHtml(paymentUrl)}" style="display:inline-block;padding:14px 36px;font-size:14px;font-weight:600;color:#ffffff;background:#111111;border:1px solid #111111;text-decoration:none;letter-spacing:0.02em;">Pay ${escapeHtml(payLabel)}</a>
            </td>
          </tr>
          <tr>
            <td style="padding:0 32px 8px;text-align:center;font-size:12px;color:#737373;line-height:1.55;">
              Secure card payment · Receipt emailed when payment clears
            </td>
          </tr>
          <tr>
            <td style="padding:0 32px 28px;text-align:center;font-size:12px;color:#a3a3a3;line-height:1.6;">
              Button not working? Copy this link:<br>
              <a href="${escapeHtml(paymentUrl)}" style="color:#111111;text-decoration:underline;">${escapeHtml(paymentUrl)}</a>
            </td>
          </tr>
          <tr>
            <td style="padding:20px 32px;border-top:1px solid #e5e5e5;font-size:13px;line-height:1.65;color:#404040;">
              Questions about this invoice? Reply to this email and we will be happy to help.
            </td>
          </tr>
          <tr>
            <td style="padding:18px 32px 24px;background:#fafafa;border-top:1px solid #e5e5e5;text-align:center;">
              <div style="font-size:13px;font-weight:600;color:#111111;margin-bottom:4px;">${escapeHtml(organizationName)}</div>
              <div style="font-size:12px;color:#737373;">${escapeHtml(tagline)}</div>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
};

/** @deprecated Use buildInvoiceEmailPlainText */
export const buildDefaultInvoiceEmailMessage = buildInvoiceEmailPlainText;

export const resolveInvoiceEmailRecipientName = ({
  contact,
  company,
}: {
  contact?: Contact | null;
  company?: Company | null;
}) => formatContactName(contact) || company?.name?.trim() || null;

export const buildOrganizationEmailTagline = (_config?: {
  website?: string | null;
  city?: string | null;
  state?: string | null;
}) => buildInvoiceOrganizationEmailTagline();
