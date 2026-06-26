/** Mirrors src/modules/tickets/ticketReplyAttachmentLimits.ts */
export const MAX_TICKET_REPLY_ATTACHMENT_BYTES = 5 * 1024 * 1024;

export const TICKET_REPLY_ATTACHMENT_TOO_LARGE_MESSAGE =
  "Each email attachment must be 5 MB or smaller. Compress the file or share a download link instead.";

export const isTicketReplyAttachmentTooLarge = (bytes: number) =>
  bytes > MAX_TICKET_REPLY_ATTACHMENT_BYTES;
