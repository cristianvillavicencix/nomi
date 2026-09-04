import { zipSync } from "fflate";
import type { DealResource } from "@/modules/types";
import {
  groupBeforeAfterResourcesIntoPairs,
  type BeforeAfterPairView,
} from "@/modules/deals/beforeAfterResourcePairs";
import { getProjectResourceSignedUrl } from "@/modules/deals/projectResourceUpload";

export type ResourceZipLayout = "flat" | "before-after";

export type DownloadResourcesAsZipOptions = {
  layout?: ResourceZipLayout;
  /** Service / tab label shown in README (e.g. Exterior Painting). */
  contextLabel?: string;
};

const sanitizeFilename = (value: string) =>
  value.replace(/[/\\?%*:|"<>]/g, "-").trim() || "file";

const sanitizePathSegment = (value: string) =>
  sanitizeFilename(value).replace(/\s+/g, "-").replace(/-+/g, "-");

const extensionFromName = (name: string) => {
  const match = /\.[a-z0-9]{1,8}$/i.exec(name);
  return match ? match[0].toLowerCase() : "";
};

const extensionFromResource = (entry: DealResource) => {
  const fromTitle = extensionFromName(entry.file.title || "");
  if (fromTitle) return fromTitle;
  const fromPath = extensionFromName(entry.file.path || "");
  if (fromPath) return fromPath;
  const mime = String(entry.file.type ?? entry.mime_kind ?? "").toLowerCase();
  if (mime.includes("png")) return ".png";
  if (mime.includes("webp")) return ".webp";
  if (mime.includes("gif")) return ".gif";
  if (mime.includes("svg")) return ".svg";
  if (mime.includes("jpeg") || mime.includes("jpg")) return ".jpg";
  if (mime.includes("mp4")) return ".mp4";
  if (mime.includes("quicktime") || mime.includes("mov")) return ".mov";
  if (mime.includes("pdf")) return ".pdf";
  return ".bin";
};

const resolveResourceDownloadUrl = async (entry: DealResource) => {
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

const fetchResourceBytes = async (entry: DealResource) => {
  const url = await resolveResourceDownloadUrl(entry);
  if (!url) return null;
  const response = await fetch(url);
  if (!response.ok) return null;
  return new Uint8Array(await response.arrayBuffer());
};

const pairFolderName = (pair: BeforeAfterPairView, index: number) => {
  const n = String(index + 1).padStart(2, "0");
  const slug = pair.description
    ? sanitizePathSegment(pair.description).slice(0, 48)
    : "untitled";
  return `pair-${n}-${slug || "untitled"}`;
};

const buildBeforeAfterReadme = ({
  zipBaseName,
  contextLabel,
  pairs,
}: {
  zipBaseName: string;
  contextLabel?: string;
  pairs: BeforeAfterPairView[];
}) => {
  const lines = [
    "Before & After photo export",
    "===========================",
    "",
    `Archive: ${zipBaseName}.zip`,
    contextLabel ? `Service: ${contextLabel}` : null,
    `Generated: ${new Date().toISOString()}`,
    "",
    "How to use this folder",
    "----------------------",
    "- Each pair-* folder is one transformation (one before + one after).",
    "- Prefer the matching before/after files inside the same pair folder.",
    "- description.txt is the client caption for that pair (may be empty).",
    "- Do not mix before/after files across different pair folders.",
    "",
    "Pairs index",
    "-----------",
  ].filter((line): line is string => line != null);

  pairs.forEach((pair, index) => {
    const folder = pairFolderName(pair, index);
    lines.push("");
    lines.push(`${index + 1}. ${pair.description || "(no description)"}`);
    lines.push(`   Folder: ${folder}/`);
    lines.push(
      `   Before: ${pair.before ? `${folder}/before${extensionFromResource(pair.before)}` : "(missing)"}`,
    );
    lines.push(
      `   After:  ${pair.after ? `${folder}/after${extensionFromResource(pair.after)}` : "(missing)"}`,
    );
    if (pair.description) {
      lines.push(`   Description: ${pair.description}`);
    }
  });

  lines.push("");
  lines.push("End of manifest");
  lines.push("");
  return lines.join("\n");
};

const buildFlatReadme = ({
  zipBaseName,
  contextLabel,
  files,
}: {
  zipBaseName: string;
  contextLabel?: string;
  files: Array<{ path: string; label: string }>;
}) => {
  const lines = [
    "Project resources export",
    "========================",
    "",
    `Archive: ${zipBaseName}.zip`,
    contextLabel ? `Section: ${contextLabel}` : null,
    `Generated: ${new Date().toISOString()}`,
    "",
    "Files",
    "-----",
    ...files.map((file, index) => `${index + 1}. ${file.path} — ${file.label}`),
    "",
    "End of manifest",
    "",
  ].filter((line): line is string => line != null);
  return lines.join("\n");
};

const encoder = new TextEncoder();

export const downloadResourcesAsZip = async (
  items: DealResource[],
  zipBaseName: string,
  options: DownloadResourcesAsZipOptions = {},
) => {
  if (items.length === 0) {
    throw new Error("No files to download");
  }

  const layout = options.layout ?? "flat";
  const zipEntries: Record<string, Uint8Array> = {};
  const usedNames = new Map<string, number>();

  if (layout === "before-after") {
    const pairs = groupBeforeAfterResourcesIntoPairs(items);
    for (const [index, pair] of pairs.entries()) {
      const folder = pairFolderName(pair, index);
      if (pair.before) {
        const bytes = await fetchResourceBytes(pair.before);
        if (bytes) {
          zipEntries[`${folder}/before${extensionFromResource(pair.before)}`] =
            bytes;
        }
      }
      if (pair.after) {
        const bytes = await fetchResourceBytes(pair.after);
        if (bytes) {
          zipEntries[`${folder}/after${extensionFromResource(pair.after)}`] =
            bytes;
        }
      }
      zipEntries[`${folder}/description.txt`] = encoder.encode(
        [
          `Pair ${index + 1}`,
          options.contextLabel ? `Service: ${options.contextLabel}` : null,
          `Description: ${pair.description || "(none)"}`,
          "",
          "Use before.* and after.* from this same folder together.",
          "",
        ]
          .filter((line): line is string => line != null)
          .join("\n"),
      );
    }

    zipEntries["README.txt"] = encoder.encode(
      buildBeforeAfterReadme({
        zipBaseName,
        contextLabel: options.contextLabel,
        pairs,
      }),
    );
  } else {
    const listed: Array<{ path: string; label: string }> = [];
    for (const [index, entry] of items.entries()) {
      const bytes = await fetchResourceBytes(entry);
      if (!bytes) continue;
      const ext = extensionFromResource(entry);
      const label = entry.label?.trim() || entry.file.title || `file-${entry.id}`;
      const base = sanitizePathSegment(label).replace(/\.[a-z0-9]+$/i, "");
      const filename = uniqueZipEntryName(
        `${String(index + 1).padStart(2, "0")}-${base || "file"}${ext}`,
        usedNames,
      );
      zipEntries[filename] = bytes;
      listed.push({ path: filename, label });
    }

    zipEntries["README.txt"] = encoder.encode(
      buildFlatReadme({
        zipBaseName,
        contextLabel: options.contextLabel,
        files: listed,
      }),
    );
  }

  const fileKeys = Object.keys(zipEntries).filter((key) => key !== "README.txt");
  if (fileKeys.length === 0) {
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
