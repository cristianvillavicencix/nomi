import type { MessageAsset } from "@/modules/tickets/ticketMessageAssets";

const normalizeAttachmentReference = (value: string) => {
  const trimmed = value.trim().toLowerCase();
  if (!trimmed) return "";
  try {
    const url = new URL(trimmed, "https://local.invalid");
    return `${url.pathname}${url.search}`.replace(/^\//, "");
  } catch {
    return trimmed.replace(/^\//, "");
  }
};

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
) => assets.filter((asset) => !isInlineTicketAttachment(asset, htmlBody));
