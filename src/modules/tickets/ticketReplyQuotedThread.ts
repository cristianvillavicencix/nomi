import type { TicketMessage } from "@/modules/types";
import { sanitizeTicketEmailHtml } from "@/modules/tickets/sanitizeTicketEmailHtml";
import {
  htmlToPlainText,
  plainTextToEditorHtml,
} from "@/modules/tickets/ticketReplyRichText";

export const TICKET_REPLY_QUOTE_SELECTOR = '[data-ticket-reply-quote="true"]';

const escapeHtml = (value: string) =>
  value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

export const formatQuotedReplyHeader = (
  message: Pick<TicketMessage, "from_email" | "from_name" | "created_at">,
) => {
  const date = message.created_at
    ? new Date(message.created_at).toLocaleString("en-US", {
        dateStyle: "medium",
        timeStyle: "short",
      })
    : "";

  const fromEmail = message.from_email?.trim();
  const fromName = message.from_name?.trim();
  const fromLabel =
    fromEmail && fromName
      ? `${fromName} <${fromEmail}>`
      : fromEmail || fromName || "Customer";

  return date ? `On ${date}, ${fromLabel} wrote:` : `${fromLabel} wrote:`;
};

export const buildQuotedReplyPlainText = (message: TicketMessage) => {
  const body =
    message.body?.trim() ||
    htmlToPlainText(message.html_body ?? "") ||
    "(No message body)";

  const quotedLines = body
    .split("\n")
    .map((line) => `> ${line}`)
    .join("\n");

  return `${formatQuotedReplyHeader(message)}\n${quotedLines}`;
};

export const buildQuotedReplyEditorHtml = (message: TicketMessage) => {
  const header = escapeHtml(formatQuotedReplyHeader(message));
  const htmlBody = message.html_body?.trim();

  const bodyHtml = htmlBody
    ? `<div class="ticket-reply-quoted-body" style="color:#374151;">${sanitizeTicketEmailHtml(htmlBody)}</div>`
    : `<blockquote style="margin:0;padding-left:12px;border-left:3px solid #d1d5db;color:#374151;">${plainTextToEditorHtml(
        message.body?.trim() || "(No message body)",
      )}</blockquote>`;

  return `<div data-ticket-reply-quote="true" contenteditable="false" style="margin-top:16px;padding-top:12px;border-top:1px solid #e5e7eb;color:#6b7280;font-size:13px;line-height:1.5;">
<p style="margin:0 0 8px;">${header}</p>
${bodyHtml}
</div>`;
};
