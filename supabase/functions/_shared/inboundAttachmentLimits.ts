/** Align inbound uploads with outbound ticket attachment limits. */
export const MAX_INBOUND_ATTACHMENTS = 10;
export const MAX_INBOUND_ATTACHMENT_BYTES = 10 * 1024 * 1024;

export const assertInboundAttachmentCount = (count: number) => {
  if (count > MAX_INBOUND_ATTACHMENTS) {
    throw new Error(
      `Too many attachments (max ${MAX_INBOUND_ATTACHMENTS})`,
    );
  }
};

export const assertInboundAttachmentSize = (bytes: number, title: string) => {
  if (bytes > MAX_INBOUND_ATTACHMENT_BYTES) {
    throw new Error(
      `Attachment "${title}" exceeds ${MAX_INBOUND_ATTACHMENT_BYTES / (1024 * 1024)}MB limit`,
    );
  }
};
