import type { FileAttachment } from "@/lib/fileAttachments";
import { resolvePrivateStorageSignedUrl } from "@/lib/supabase/privateStorageFile";
import {
  normalizeContentId,
  rewriteCidReferencesInHtml,
} from "@/modules/mail/mailInlineImages";

const TICKET_ATTACHMENTS_BUCKET = "attachments";

const attachmentStorageKey = (file: FileAttachment) =>
  file.path?.trim() || file.src?.trim() || "";

const escapeRegExp = (value: string) =>
  value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** Resolve cid: references and storage paths in ticket email HTML for display. */
export async function resolveTicketInlineHtml(
  html: string,
  attachments: FileAttachment[],
): Promise<string> {
  if (!html.trim()) return html;

  let result = html;
  const cidToUrl = new Map<string, string>();

  const inlineFiles = attachments.filter(
    (file) => file.contentId?.trim() && attachmentStorageKey(file),
  );

  await Promise.all(
    inlineFiles.map(async (file) => {
      const reference = attachmentStorageKey(file);
      const signed = await resolvePrivateStorageSignedUrl({
        reference,
        defaultBucket: TICKET_ATTACHMENTS_BUCKET,
      });
      if (!signed || !file.contentId) return;
      cidToUrl.set(file.contentId, signed);
      cidToUrl.set(normalizeContentId(file.contentId), signed);
    }),
  );

  if (cidToUrl.size > 0) {
    result = rewriteCidReferencesInHtml(result, cidToUrl);
  }

  const pathToUrl = new Map<string, string>();

  await Promise.all(
    attachments.map(async (file) => {
      const reference = attachmentStorageKey(file);
      if (!reference || reference.startsWith("http")) return;
      if (pathToUrl.has(reference)) return;
      const signed = await resolvePrivateStorageSignedUrl({
        reference,
        defaultBucket: TICKET_ATTACHMENTS_BUCKET,
      });
      if (signed) pathToUrl.set(reference, signed);
    }),
  );

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
}
