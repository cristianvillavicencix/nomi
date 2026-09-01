import type { MessageAsset } from "@/modules/tickets/ticketMessageAssets";
import {
  isInlineImageRenderedInHtml,
  normalizeAttachmentReference,
} from "@/modules/tickets/ticketInlineHtmlUtils";

/** Inline signature/logo images stay in the HTML body — not the attachment bar. */
export const isInlineTicketAttachment = (
  asset: MessageAsset,
  htmlBody?: string | null,
) => {
  if (asset.contentId?.trim()) return true;
  if (asset.category !== "photo" || asset.source !== "file") return false;
  const html = htmlBody?.trim();
  if (!html) return false;

  const references = [asset.href, asset.path]
    .filter(Boolean)
    .map((value) => normalizeAttachmentReference(String(value)));

  const htmlLower = html.toLowerCase();
  return references.some((reference) => reference && htmlLower.includes(reference));
};

export const filterDownloadableMessageAssets = (
  assets: MessageAsset[],
  htmlBody?: string | null,
  displayHtml?: string | null,
) =>
  assets.filter((asset) => {
    // Photo files always get a download row — even when also shown inline in HTML.
    if (asset.category === "photo" && asset.source === "file") {
      return true;
    }
    if (!isInlineTicketAttachment(asset, htmlBody ?? displayHtml)) {
      return true;
    }

    return !isInlineImageRenderedInHtml(
      {
        title: asset.label,
        type: asset.type,
        src: asset.href,
        path: asset.path,
        contentId: asset.contentId,
      },
      displayHtml ?? htmlBody,
      asset.href,
    );
  });
