import { supabaseAdmin } from "./supabaseAdmin.ts";
import {
  formatSkippedAttachmentsNote,
  MAX_INBOUND_ATTACHMENTS,
  type SkippedInboundAttachment,
} from "./inboundAttachmentLimits.ts";
import type { Attachment } from "../postmark/extractAndUploadAttachments.ts";

export type InboundAttachmentUploadResult = {
  attachments: Attachment[];
  skippedAttachments: SkippedInboundAttachment[];
};

export const uploadInboundAttachmentBytes = async (
  params: {
    title: string;
    type: string;
    bytes: ArrayBuffer;
    contentId?: string | null;
    maxBytes: number;
  },
): Promise<
  | { attachment: Attachment; skipped?: undefined }
  | { attachment?: undefined; skipped: SkippedInboundAttachment }
> => {
  const title = params.title.trim() || "attachment";
  const bytes = params.bytes;

  if (bytes.byteLength > params.maxBytes) {
    return {
      skipped: {
        title,
        bytes: bytes.byteLength,
        reason: "size_limit",
      },
    };
  }

  const fileParts = title.split(".");
  const fileExt = fileParts.length > 1 ? `.${fileParts.pop()}` : "";
  const fileName = `${Math.random()}${fileExt}`;

  const { error: uploadError } = await supabaseAdmin.storage
    .from("attachments")
    .upload(fileName, bytes, { contentType: params.type || "application/octet-stream" });

  if (uploadError) {
    console.error("uploadInboundAttachmentBytes.upload_error", uploadError);
    return {
      skipped: {
        title,
        bytes: bytes.byteLength,
        reason: "upload_failed",
      },
    };
  }

  return {
    attachment: {
      title,
      type: params.type || "application/octet-stream",
      path: fileName,
      src: fileName,
      contentId: params.contentId?.trim() || null,
    },
  };
};

export const appendSkippedAttachmentsToBody = (
  body: string,
  skipped: SkippedInboundAttachment[],
  maxBytes: number,
) => {
  const note = formatSkippedAttachmentsNote(skipped, maxBytes);
  if (!note) return body;
  return `${body.trim()}${note}`;
};

export const enforceAttachmentCountLimit = (
  attachmentKeys: string[],
  skipped: SkippedInboundAttachment[],
) => {
  if (attachmentKeys.length <= MAX_INBOUND_ATTACHMENTS) {
    return { allowedKeys: attachmentKeys, skipped };
  }

  const allowedKeys = attachmentKeys.slice(0, MAX_INBOUND_ATTACHMENTS);
  const overflow = attachmentKeys.slice(MAX_INBOUND_ATTACHMENTS);
  const nextSkipped = [...skipped];
  for (const key of overflow) {
    nextSkipped.push({
      title: key,
      bytes: 0,
      reason: "count_limit",
    });
  }
  return { allowedKeys, skipped: nextSkipped };
};
