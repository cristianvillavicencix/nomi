import { getFileKind } from "@/lib/fileAttachments";
import {
  downloadPrivateStorageFile,
  openPrivateStorageFile,
} from "@/lib/supabase/privateStorageFile";
import type { MessageAsset } from "@/modules/tickets/ticketMessageAssets";

const safeFilename = (value: string) =>
  value.replace(/[/\\?%*:| "<>]/g, "-").trim() || "attachment";

const ticketAssetStorageInput = (asset: MessageAsset) => ({
  reference: asset.href?.trim() || asset.path?.trim() || "",
  defaultBucket: "attachments",
  filename: safeFilename(asset.label),
});

export const isDownloadableFileAsset = (asset: MessageAsset) =>
  asset.source === "file" &&
  (Boolean(asset.href?.trim()) || Boolean(asset.path?.trim()));

export const isPreviewablePdfAsset = (asset: MessageAsset) =>
  getFileKind({
    title: asset.label,
    type: asset.type,
    src: asset.href,
    path: asset.path,
  }) === "pdf";

export const downloadTicketAsset = async (asset: MessageAsset) => {
  await downloadPrivateStorageFile(ticketAssetStorageInput(asset));
};

/** PDFs open in a new tab; other files download. */
export const openTicketAsset = async (asset: MessageAsset) => {
  const input = ticketAssetStorageInput(asset);
  if (isPreviewablePdfAsset(asset)) {
    await openPrivateStorageFile(input);
    return;
  }
  await downloadPrivateStorageFile(input);
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
