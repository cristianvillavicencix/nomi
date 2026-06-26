/** Email replies are sent via Twilio; keep attachments small to avoid 413 / memory errors. */
export const MAX_TICKET_REPLY_ATTACHMENT_BYTES = 5 * 1024 * 1024;

export const TICKET_REPLY_ATTACHMENT_LIMIT_LABEL = "5 MB";

export const TICKET_REPLY_ATTACHMENT_HINT =
  "Up to 5 MB per file for email replies. Use a download link for larger files.";

export const isTicketReplyAttachmentTooLarge = (bytes: number) =>
  bytes > MAX_TICKET_REPLY_ATTACHMENT_BYTES;

export const ticketReplyAttachmentTooLargeMessage = (fileName: string) =>
  `"${fileName}" is too large. Email attachments are limited to ${TICKET_REPLY_ATTACHMENT_LIMIT_LABEL} per file.`;
