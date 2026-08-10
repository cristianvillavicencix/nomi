import PostalMime from "npm:postal-mime@2.4.3";
import type { PostmarkInboundPayload } from "../postmark/processTicketInbound.ts";
import type { Attachment } from "../postmark/extractAndUploadAttachments.ts";
import type { SkippedInboundAttachment } from "../_shared/inboundAttachmentLimits.ts";
import { uploadInboundAttachmentBytes } from "../_shared/uploadInboundAttachments.ts";

const toAddressList = (
  addresses: Array<{ name?: string; address?: string }> | undefined,
) =>
  (addresses ?? [])
    .filter((row) => row.address?.trim())
    .map((row) => ({
      Email: row.address!.trim(),
      Name: row.name?.trim() || undefined,
    }));

export const parseRawEmailInbound = async (
  rawEml: Uint8Array | ArrayBuffer,
  maxBytes: number,
): Promise<{
  payload: PostmarkInboundPayload;
  attachments: Attachment[];
  skippedAttachments: SkippedInboundAttachment[];
}> => {
  const parser = new PostalMime();
  const email = await parser.parse(rawEml);

  const headers = (email.headers ?? []).map((header) => ({
    Name: header.key,
    Value: String(header.value ?? ""),
  }));

  const messageId =
    email.messageId?.replace(/^<|>$/g, "").trim() || crypto.randomUUID();

  const payload: PostmarkInboundPayload = {
    MessageID: messageId,
    Subject: email.subject ?? "",
    TextBody: email.text ?? "",
    HtmlBody: email.html ?? undefined,
    FromFull: email.from
      ? {
          Email: email.from.address ?? "",
          Name: email.from.name ?? undefined,
        }
      : undefined,
    ToFull: toAddressList(email.to),
    CcFull: toAddressList(email.cc),
    Headers: headers,
    OriginalRecipient: email.to?.[0]?.address,
  };

  const attachments: Attachment[] = [];
  const skippedAttachments: SkippedInboundAttachment[] = [];

  for (const attachment of email.attachments ?? []) {
    const title =
      attachment.filename?.trim() ||
      attachment.mimeType?.trim() ||
      "attachment";
    const type = attachment.mimeType || "application/octet-stream";
    const content = attachment.content;
    const bytes =
      content instanceof ArrayBuffer
        ? content
        : content.buffer.slice(content.byteOffset, content.byteOffset + content.byteLength);

    const result = await uploadInboundAttachmentBytes({
      title,
      type,
      bytes,
      contentId: attachment.contentId?.trim() || null,
      maxBytes,
    });

    if (result.attachment) {
      attachments.push(result.attachment);
    } else if (result.skipped) {
      skippedAttachments.push(result.skipped);
    }
  }

  return { payload, attachments, skippedAttachments };
};
