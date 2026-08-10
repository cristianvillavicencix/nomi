/** Align inbound uploads with outbound ticket attachment limits. */
export const MAX_INBOUND_ATTACHMENTS = 10;
export const DEFAULT_MAX_INBOUND_ATTACHMENT_BYTES = 25 * 1024 * 1024;

export type SkippedInboundAttachment = {
  title: string;
  bytes: number;
  reason: "size_limit" | "upload_failed" | "count_limit" | "decode_failed";
};

export const resolveMaxInboundAttachmentBytes = (
  configured?: number | null,
) => {
  if (
    typeof configured === "number" &&
    Number.isFinite(configured) &&
    configured > 0
  ) {
    return Math.min(configured, 30 * 1024 * 1024);
  }
  return DEFAULT_MAX_INBOUND_ATTACHMENT_BYTES;
};

export const assertInboundAttachmentCount = (
  count: number,
  skipped: SkippedInboundAttachment[] = [],
) => {
  if (count > MAX_INBOUND_ATTACHMENTS) {
    throw new Error(`Too many attachments (max ${MAX_INBOUND_ATTACHMENTS})`);
  }
  if (count + skipped.filter((row) => row.reason === "count_limit").length >
      MAX_INBOUND_ATTACHMENTS) {
    throw new Error(`Too many attachments (max ${MAX_INBOUND_ATTACHMENTS})`);
  }
};

export const formatBytesLabel = (bytes: number) => {
  if (bytes >= 1024 * 1024) {
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }
  if (bytes >= 1024) {
    return `${Math.round(bytes / 1024)} KB`;
  }
  return `${bytes} B`;
};

export const formatSkippedAttachmentsNote = (
  skipped: SkippedInboundAttachment[],
  maxBytes: number,
) => {
  if (!skipped.length) return "";
  const limitLabel = formatBytesLabel(maxBytes);
  const lines = skipped.map((row) => {
    const reasonLabel =
      row.reason === "size_limit"
        ? `limit ${limitLabel}`
        : row.reason === "count_limit"
          ? "attachment count limit"
          : row.reason === "decode_failed"
            ? "could not decode"
            : "upload failed";
    return `- ${row.title} (${formatBytesLabel(row.bytes)}, ${reasonLabel})`;
  });
  return `\n\n---\nSkipped attachments:\n${lines.join("\n")}`;
};
