import { downloadPrivateStorageFile } from "@/lib/supabase/privateStorageFile";
import type { MessageAsset } from "@/modules/tickets/ticketMessageAssets";

const safeFilename = (value: string) =>
  value.replace(/[/\\?%*:| "<>]/g, "-").trim() || "attachment";

export const isDownloadableFileAsset = (asset: MessageAsset) =>
  asset.source === "file" &&
  (Boolean(asset.href?.trim()) || Boolean(asset.path?.trim()));

export const downloadTicketAsset = async (asset: MessageAsset) => {
  const filename = safeFilename(asset.label);
  await downloadPrivateStorageFile({
    reference: asset.href,
    defaultBucket: "attachments",
    filename,
  });
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
