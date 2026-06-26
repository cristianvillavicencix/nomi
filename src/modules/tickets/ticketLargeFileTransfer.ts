import { TICKET_REPLY_ATTACHMENT_LIMIT_LABEL } from "@/modules/tickets/ticketReplyAttachmentLimits";
import {
  buildReplySignatureEditorHtml,
  includesReplySignatureHtml,
  TICKET_REPLY_SIGNATURE_SELECTOR,
} from "@/modules/tickets/ticketReplyRichText";

export const LARGE_FILE_TRANSFER_URL = "https://transfer.it/";

export const TICKET_REPLY_ATTACHMENT_HINT_BEFORE = `Up to ${TICKET_REPLY_ATTACHMENT_LIMIT_LABEL} per attached file. For larger files, upload at `;

export const TICKET_REPLY_ATTACHMENT_HINT_AFTER =
  " and paste the download link in your message.";

export const TICKET_REPLY_ATTACHMENT_HINT = `${TICKET_REPLY_ATTACHMENT_HINT_BEFORE}transfer.it${TICKET_REPLY_ATTACHMENT_HINT_AFTER}`;

export const ticketReplyAttachmentTooLargeMessage = (fileName: string) =>
  `"${fileName}" exceeds the ${TICKET_REPLY_ATTACHMENT_LIMIT_LABEL} email limit. Use transfer.it and paste the download link in your reply.`;

const escapeHtml = (value: string) =>
  value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

export const buildLargeFileTransferComposerHtml = (fileName?: string) => {
  const trimmedName = fileName?.trim();
  const fileLine = trimmedName
    ? `<p style="margin:0 0 8px;"><strong>File:</strong> ${escapeHtml(trimmedName)}</p>`
    : "";

  return `<div data-ticket-large-file-transfer="true" style="margin:0 0 12px;padding:10px 12px;border:1px solid #e5e7eb;border-radius:6px;background:#f9fafb;">
<p style="margin:0 0 8px;font-weight:600;">Large file download</p>
${fileLine}
<p style="margin:0 0 8px;">1. Upload at <a href="${LARGE_FILE_TRANSFER_URL}" target="_blank" rel="noopener noreferrer">transfer.it</a></p>
<p style="margin:0 0 8px;">2. Paste your download link below:</p>
<p style="margin:0;"><a href="https://">Download link</a></p>
</div>`;
};

export const insertHtmlAboveSignatureHtml = (
  html: string,
  insertionHtml: string,
) => {
  const insertion = insertionHtml.trim();
  if (!insertion) return html;

  if (!includesReplySignatureHtml(html)) {
    const trimmed = html.trim();
    if (!trimmed) return `${insertion}${buildReplySignatureEditorHtml()}`;
    return `${insertion}${trimmed}`;
  }

  if (typeof document === "undefined") {
    return `${insertion}${html}`;
  }

  const container = document.createElement("div");
  container.innerHTML = html;
  const signature = container.querySelector(TICKET_REPLY_SIGNATURE_SELECTOR);
  if (!signature) {
    return `${insertion}${html}`;
  }

  const wrapper = document.createElement("div");
  wrapper.innerHTML = insertion;
  while (wrapper.firstChild) {
    container.insertBefore(wrapper.firstChild, signature);
  }

  return container.innerHTML;
};

export const openLargeFileTransferUpload = () => {
  if (typeof window === "undefined") return;
  window.open(LARGE_FILE_TRANSFER_URL, "_blank", "noopener,noreferrer");
};
