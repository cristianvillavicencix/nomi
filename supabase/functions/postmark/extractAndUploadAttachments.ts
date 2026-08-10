import { decode } from "npm:base64-arraybuffer";
import {
  MAX_INBOUND_ATTACHMENTS,
  type SkippedInboundAttachment,
} from "../_shared/inboundAttachmentLimits.ts";
import {
  enforceAttachmentCountLimit,
  uploadInboundAttachmentBytes,
} from "../_shared/uploadInboundAttachments.ts";

export type Attachment = {
  title: string;
  type: string;
  path: string;
  src: string;
  /** Postmark inline image Content-ID (cid:…) */
  contentId?: string | null;
};

export const extractAndUploadAttachments = async (
  Attachments: {
    Name: string;
    Content: string;
    ContentType: string;
    ContentLength: number;
    ContentID?: string | null;
  }[],
  maxBytes: number,
): Promise<{
  attachments: Attachment[];
  skippedAttachments: SkippedInboundAttachment[];
}> => {
  const list = Attachments || [];
  const skippedAttachments: SkippedInboundAttachment[] = [];
  const { allowedKeys } = enforceAttachmentCountLimit(
    list.map((_, index) => `attachment${index + 1}`),
    skippedAttachments,
  );
  const allowed = list.slice(0, allowedKeys.length || MAX_INBOUND_ATTACHMENTS);

  const attachments: Attachment[] = [];

  for (const attachment of allowed) {
    const { Name, Content, ContentType, ContentID } = attachment;
    if (!Name || !Content || !ContentType) {
      console.warn("Attachment is missing required fields, skipping", {
        attachment,
      });
      continue;
    }

    const decodedContent = decode(Content);
    if (!decodedContent) {
      skippedAttachments.push({
        title: Name,
        bytes: 0,
        reason: "decode_failed",
      });
      continue;
    }

    const result = await uploadInboundAttachmentBytes({
      title: Name,
      type: ContentType,
      bytes: decodedContent,
      contentId: ContentID?.trim() || null,
      maxBytes,
    });

    if (result.attachment) {
      attachments.push(result.attachment);
    } else if (result.skipped) {
      skippedAttachments.push(result.skipped);
    }
  }

  return { attachments, skippedAttachments };
};
