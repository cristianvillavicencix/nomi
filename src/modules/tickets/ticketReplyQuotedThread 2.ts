import type { TicketMessage } from "@/modules/types";
import { dedupeQuotedHtmlForDisplay } from "@/modules/tickets/dedupeQuotedEmailDisplay";
import { sanitizeTicketEmailHtmlOriginal } from "@/modules/tickets/sanitizeTicketEmailHtml";
import {
  hasRichHtmlStructure,
  isPlainTextSimilar,
  splitHtmlEmail,
  splitPlainTextEmail,
} from "@/modules/tickets/ticketEmailQuotedContent";
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
  const body = resolveQuotedMessagePlainText(message);

  const quotedLines = body
    .split("\n")
    .map((line) => `> ${line}`)
    .join("\n");

  return `${formatQuotedReplyHeader(message)}\n${quotedLines}`;
};

const resolveQuotedMessagePlainText = (message: TicketMessage) => {
  const plain = message.body?.trim();
  if (plain) {
    return splitPlainTextEmail(plain).content || plain;
  }

  return htmlToPlainText(message.html_body ?? "") || "(No message body)";
};

const resolveQuotedMessageBodyHtml = (message: TicketMessage) => {
  const html = message.html_body?.trim();
  const plain = message.body?.trim();
  const plainMain = plain ? splitPlainTextEmail(plain).content || plain : "";

  if (html) {
    const split = splitHtmlEmail(html);
    const mainHtml = (split.content || html).trim();
    const mainPlain = htmlToPlainText(mainHtml);

    const useFormattedHtml =
      hasRichHtmlStructure(mainHtml) ||
      (plainMain
        ? isPlainTextSimilar(plainMain, mainPlain)
        : Boolean(mainPlain));

    if (useFormattedHtml && mainHtml) {
      return dedupeQuotedHtmlForDisplay(sanitizeTicketEmailHtmlOriginal(mainHtml));
    }
  }

  return plainTextToEditorHtml(
    plainMain || htmlToPlainText(html ?? "") || "(No message body)",
  );
};

export const buildQuotedReplyEditorHtml = (message: TicketMessage) => {
  const header = escapeHtml(formatQuotedReplyHeader(message));
  const bodyHtml = resolveQuotedMessageBodyHtml(message);

  return `<div data-ticket-reply-quote="true" contenteditable="false" style="margin-top:16px;padding-top:12px;border-top:1px solid #e5e7eb;color:#6b7280;font-size:13px;line-height:1.5;">
<p style="margin:0 0 8px;">${header}</p>
<div class="ticket-reply-quoted-body ticket-email-html" style="color:#374151;">${bodyHtml}</div>
</div>`;
};
