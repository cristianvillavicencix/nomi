import { zipSync } from "fflate";
import type { DealResource } from "@/lbs/types";
import { getProjectResourceSignedUrl } from "@/lbs/deals/projectResourceUpload";

const sanitizeFilename = (value: string) =>
  value.replace(/[/\\?%*:|"<>]/g, "-").trim() || "file";

const resolveResourceDownloadUrl = async (entry: DealResource) => {
  if (entry.file.src) return entry.file.src;
  if (entry.file.path) {
    return getProjectResourceSignedUrl(entry.file.path, entry.file.bucket);
  }
  return "";
};

const uniqueZipEntryName = (
  rawName: string,
  usedNames: Map<string, number>,
) => {
  const safeName = sanitizeFilename(rawName);
  const count = usedNames.get(safeName) ?? 0;
  usedNames.set(safeName, count + 1);
  if (count === 0) return safeName;
  const dot = safeName.lastIndexOf(".");
  if (dot > 0) {
    return `${safeName.slice(0, dot)}-${count + 1}${safeName.slice(dot)}`;
  }
  return `${safeName}-${count + 1}`;
};

export const downloadResourcesAsZip = async (
  items: DealResource[],
  zipBaseName: string,
) => {
  if (items.length === 0) {
    throw new Error("No files to download");
  }

  const zipEntries: Record<string, Uint8Array> = {};
  const usedNames = new Map<string, number>();

  for (const entry of items) {
    const url = await resolveResourceDownloadUrl(entry);
    if (!url) continue;

    const response = await fetch(url);
    if (!response.ok) continue;

    const bytes = new Uint8Array(await response.arrayBuffer());
    const filename = uniqueZipEntryName(
      entry.label?.trim() || entry.file.title || `file-${entry.id}`,
      usedNames,
    );
    zipEntries[filename] = bytes;
  }

  if (Object.keys(zipEntries).length === 0) {
    throw new Error("Could not fetch files for download");
  }

  const zipped = zipSync(zipEntries);
  const blob = new Blob([zipped], { type: "application/zip" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `${sanitizeFilename(zipBaseName)}.zip`;
  anchor.click();
  URL.revokeObjectURL(url);
};
