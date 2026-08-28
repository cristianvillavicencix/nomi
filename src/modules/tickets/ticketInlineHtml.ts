import type { FileAttachment } from "@/lib/fileAttachments";
import { resolvePrivateStorageSignedUrl } from "@/lib/supabase/privateStorageFile";
import {
  extractCidReferencesFromHtml,
  normalizeContentId,
  rewriteCidReferencesInHtml,
} from "@/modules/mail/mailInlineImages";
import {
  isInlineImageCandidate,
  isInlineImageRenderedInHtml,
} from "@/modules/tickets/ticketInlineHtmlUtils";

const TICKET_ATTACHMENTS_BUCKET = "attachments";

const attachmentStorageKey = (file: FileAttachment) =>
  file.path?.trim() || file.src?.trim() || "";

const fileNameKey = (value: string) => {
  const base = value.split(/[/\\]/).pop() ?? value;
  return normalizeContentId(base);
};

const escapeRegExp = (value: string) =>
  value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const escapeHtmlAttr = (value: string) =>
  value
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;");

const buildInlineImageTag = (src: string, alt: string) =>
  `<img src="${escapeHtmlAttr(src)}" alt="${escapeHtmlAttr(alt)}" style="display:block;margin:8px 0;max-width:100%;" />`;

const signAttachmentReference = async (file: FileAttachment) => {
  const reference = attachmentStorageKey(file);
  if (!reference) return null;
  if (
    reference.startsWith("http://") ||
    reference.startsWith("https://") ||
    reference.startsWith("blob:") ||
    reference.startsWith("data:")
  ) {
    return reference;
  }
  return resolvePrivateStorageSignedUrl({
    reference,
    defaultBucket: TICKET_ATTACHMENTS_BUCKET,
  });
};

const rewriteStoragePathsInHtml = (
  html: string,
  pathToUrl: Map<string, string>,
) => {
  let result = html;
  for (const [reference, signedUrl] of pathToUrl.entries()) {
    const escaped = escapeRegExp(reference);
    result = result.replace(
      new RegExp(`(src=(["']))${escaped}\\2`, "gi"),
      `$1${signedUrl}$2`,
    );
    result = result.replace(
      new RegExp(`(url\\((["']?))${escaped}\\2\\)`, "gi"),
      `$1${signedUrl}$2)`,
    );
  }
  return result;
};

/** Resolve inline images for ticket email HTML and append missing signature logos. */
export async function resolveTicketDisplayHtml(
  htmlBody: string | null | undefined,
  attachments: FileAttachment[],
): Promise<string | null> {
  const sourceHtml = htmlBody?.trim() ?? "";
  const signedUrls = new Map<FileAttachment, string>();

  await Promise.all(
    attachments.map(async (file) => {
      const signed = await signAttachmentReference(file);
      if (signed) signedUrls.set(file, signed);
    }),
  );

  const cidToUrl = new Map<string, string>();
  for (const file of attachments) {
    const signed = signedUrls.get(file);
    if (!signed) continue;
    const contentId = file.contentId?.trim();
    if (contentId) {
      cidToUrl.set(contentId, signed);
      cidToUrl.set(normalizeContentId(contentId), signed);
    }
    const title = file.title?.trim();
    if (title) cidToUrl.set(fileNameKey(title), signed);
    const path = attachmentStorageKey(file);
    if (path) cidToUrl.set(fileNameKey(path), signed);
  }

  if (sourceHtml) {
    const cidRefs = extractCidReferencesFromHtml(sourceHtml);
    const imageFiles = attachments.filter((file) => {
      const type = file.type?.toLowerCase() ?? "";
      const name = file.title?.toLowerCase() ?? "";
      return (
        type.startsWith("image/") ||
        /\.(png|jpe?g|gif|webp|svg|bmp)$/i.test(name)
      );
    });
    for (const cid of cidRefs) {
      if (cidToUrl.has(cid)) continue;
      const match = imageFiles.find((file) => {
        const title = file.title ? fileNameKey(file.title) : "";
        const path = attachmentStorageKey(file)
          ? fileNameKey(attachmentStorageKey(file))
          : "";
        const contentId = file.contentId
          ? normalizeContentId(file.contentId)
          : "";
        return cid === title || cid === path || cid === contentId;
      });
      const signed = match ? signedUrls.get(match) : undefined;
      if (signed) cidToUrl.set(cid, signed);
    }
  }

  let result = sourceHtml;
  if (result && cidToUrl.size > 0) {
    result = rewriteCidReferencesInHtml(result, cidToUrl);
  }

  if (result) {
    const pathToUrl = new Map<string, string>();
    for (const file of attachments) {
      const reference = attachmentStorageKey(file);
      const signed = signedUrls.get(file);
      if (!reference || !signed || reference.startsWith("http")) continue;
      pathToUrl.set(reference, signed);
    }
    result = rewriteStoragePathsInHtml(result, pathToUrl);
  }

  const inlineCandidates = attachments.filter((file) =>
    isInlineImageCandidate(file, sourceHtml),
  );

  const missingInline = inlineCandidates.filter((file) => {
    const signed = signedUrls.get(file);
    if (!signed) return false;
    return !isInlineImageRenderedInHtml(file, result, signed);
  });

  if (missingInline.length > 0) {
    const block = missingInline
      .map((file) =>
        buildInlineImageTag(
          signedUrls.get(file)!,
          file.title?.trim() || "Inline image",
        ),
      )
      .join("");
    result = result ? `${result}<div>${block}</div>` : `<div>${block}</div>`;
  }

  return result || null;
}

/** @deprecated Use resolveTicketDisplayHtml */
export const resolveTicketInlineHtml = resolveTicketDisplayHtml;
