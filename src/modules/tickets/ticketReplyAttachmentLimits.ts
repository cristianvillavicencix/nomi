/** Email replies are sent via Twilio; keep attachments small to avoid 413 / memory errors. */
export const MAX_TICKET_REPLY_ATTACHMENT_BYTES = 5 * 1024 * 1024;

export const TICKET_REPLY_ATTACHMENT_LIMIT_LABEL = "5 MB";

export const isTicketReplyAttachmentTooLarge = (bytes: number) =>
  bytes > MAX_TICKET_REPLY_ATTACHMENT_BYTES;
