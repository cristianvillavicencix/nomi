import { resolveStorageDisplayUrl } from "@/lib/supabase/storageObjectUrl";
import type { MessageAsset } from "@/modules/tickets/ticketMessageAssets";

const safeFilename = (value: string) =>
  value.replace(/[/\\?%*:| "<>]/g, "-").trim() || "attachment";

const resolveTicketAssetUrl = async (asset: MessageAsset) =>
  (await resolveStorageDisplayUrl(asset.href, {
    defaultBucket: "attachments",
  })) ?? asset.href;

export const isDownloadableFileAsset = (asset: MessageAsset) =>
  asset.source === "file" && /^https?:\/\//i.test(asset.href);

export const downloadTicketAsset = async (asset: MessageAsset) => {
  const filename = safeFilename(asset.label);
  const href = await resolveTicketAssetUrl(asset);
  try {
    const response = await fetch(href);
    if (!response.ok) throw new Error("Download failed");
    const blob = await response.blob();
    const objectUrl = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = objectUrl;
    anchor.download = filename;
    anchor.rel = "noopener";
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    window.setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
  } catch {
    const anchor = document.createElement("a");
    anchor.href = href;
    anchor.download = filename;
    anchor.target = "_blank";
    anchor.rel = "noopener noreferrer";
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
  }
};

export const downloadTicketAssets = async (assets: MessageAsset[]) => {
  const files = assets.filter(isDownloadableFileAsset);
  for (const [index, asset] of files.entries()) {
    await downloadTicketAsset(asset);
    if (index < files.length - 1) {
      await new Promise((resolve) => window.setTimeout(resolve, 350));
    }
  }
  return files.length;
};
