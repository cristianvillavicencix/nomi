/** Mirrors src/modules/tickets/ticketReplyAttachmentLimits.ts */

/** Absolute max for reply uploads (inline email OR 7-day download link). */
export const MAX_TICKET_REPLY_STORAGE_ATTACHMENT_BYTES = 25 * 1024 * 1024;

/**
 * Default / soft max for MIME attachments embedded in the email.
 * Larger files are sent as 7-day signed download links.
 */
export const MAX_TICKET_REPLY_ATTACHMENT_BYTES = 5 * 1024 * 1024;

/**
 * Hard ceiling for loading file bytes into the Edge isolate.
 * Above this we always use signed links to avoid 546 worker OOM.
 */
export const MAX_TICKET_REPLY_EDGE_INLINE_BYTES = 5 * 1024 * 1024;

export const TICKET_REPLY_ATTACHMENT_TOO_LARGE_MESSAGE =
  "Each reply file must be 25 MB or smaller.";

export const isTicketReplyAttachmentTooLarge = (
  bytes: number,
  maxBytes = MAX_TICKET_REPLY_STORAGE_ATTACHMENT_BYTES,
) => bytes > maxBytes;

export const resolveInlineReplyAttachmentMaxBytes = (
  workspaceMaxBytes: number,
) =>
  Math.min(
    Math.max(1, Number(workspaceMaxBytes) || MAX_TICKET_REPLY_ATTACHMENT_BYTES),
    MAX_TICKET_REPLY_EDGE_INLINE_BYTES,
    MAX_TICKET_REPLY_STORAGE_ATTACHMENT_BYTES,
  );

export const shouldSendReplyAttachmentAsDownloadLink = (
  bytes: number | undefined,
  inlineMaxBytes: number,
  forceDownloadLink = false,
) => {
  if (forceDownloadLink) return true;
  if (typeof bytes !== "number" || !Number.isFinite(bytes)) {
    // Missing size: never pull unknown payloads into Edge memory.
    return true;
  }
  return (
    bytes > inlineMaxBytes &&
    bytes <= MAX_TICKET_REPLY_STORAGE_ATTACHMENT_BYTES
  );
};
