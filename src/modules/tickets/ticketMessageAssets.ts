import { getFileKind, type FileAttachment } from "@/lib/fileAttachments";

export type MessageAssetCategory = "document" | "video" | "photo";

export type MessageAsset = {
  href: string;
  label: string;
  category: MessageAssetCategory;
  /** Uploaded file vs link extracted from email HTML/text. */
  source: "file" | "link";
  previewSrc?: string;
  path?: string;
  type?: string;
};

const normalizeHref = (value: string) => {
  try {
    const url = new URL(value.trim());
    return `${url.origin}${url.pathname}${url.search}`.toLowerCase();
  } catch {
    return value.trim().toLowerCase();
  }
};

const VIDEO_HOSTS =
  /(?:^|\.)youtube\.com$|(?:^|\.)youtu\.be$|(?:^|\.)vimeo\.com$|(?:^|\.)loom\.com$/i;

const VIDEO_EXT = /\.(mp4|mov|webm|mkv|avi|m4v)(\?|#|$)/i;
const PHOTO_EXT = /\.(png|jpe?g|gif|webp|bmp|svg|heic|heif)(\?|#|$)/i;

const ASSET_LINK_HOST =
  /(?:^|\.)drive\.google\.com$|(?:^|\.)docs\.google\.com$|(?:^|\.)dropbox\.com$|(?:^|\.)onedrive\.live\.com$|(?:^|\.)1drv\.ms$|(?:^|\.)sharepoint\.com$|(?:^|\.)wetransfer\.com$|(?:^|\.)box\.com$/i;

const FILE_EXT_IN_URL =
  /\.(pdf|docx?|xlsx?|pptx?|zip|rar|7z|mp4|mov|webm|png|jpe?g|gif|webp)(\?|#|$)/i;

export const isAssetLikeLink = (href: string, label = "") => {
  try {
    const url = new URL(href);
    if (ASSET_LINK_HOST.test(url.hostname)) return true;
  } catch {
    return false;
  }
  const haystack = `${href} ${label}`;
  if (FILE_EXT_IN_URL.test(haystack)) return true;
  if (classifyLink(href, label) !== "document") return true;
  return false;
};

export const inferLinkLabel = (href: string) => {
  try {
    const url = new URL(href);
    const host = url.hostname.replace(/^www\./i, "");

    if (host === "drive.google.com" || host.endsWith(".google.com")) {
      if (url.pathname.includes("/document/")) return "Google Doc";
      if (url.pathname.includes("/spreadsheets/")) return "Google Sheet";
      if (url.pathname.includes("/presentation/")) return "Google Slides";
      if (url.pathname.includes("/file/")) return "Google Drive file";
      if (url.pathname.includes("/folders/")) return "Google Drive folder";
      if (host.includes("google")) return "Google Drive link";
    }
    if (host.includes("dropbox.com")) return "Dropbox file";
    if (host.includes("onedrive.live.com") || host.includes("1drv.ms")) {
      return "OneDrive file";
    }
    if (host.includes("sharepoint.com")) return "SharePoint link";

    return host || "Link";
  } catch {
    return "Link";
  }
};

export const classifyLink = (
  href: string,
  label = "",
): MessageAssetCategory => {
  const haystack = `${href} ${label}`.toLowerCase();

  try {
    const url = new URL(href);
    if (VIDEO_HOSTS.test(url.hostname)) return "video";
  } catch {
    // ignore
  }

  if (VIDEO_EXT.test(haystack)) return "video";
  if (PHOTO_EXT.test(haystack)) return "photo";

  return "document";
};

const isVideoFile = (file: FileAttachment) => {
  const type = file.type?.toLowerCase() ?? "";
  const name = file.title?.toLowerCase() ?? "";
  const src = file.src?.toLowerCase() ?? "";
  const path = file.path?.toLowerCase() ?? "";
  if (type.startsWith("video/")) return true;
  return (
    VIDEO_EXT.test(name) ||
    VIDEO_EXT.test(src) ||
    VIDEO_EXT.test(path)
  );
};

const isPhotoFile = (file: FileAttachment) => {
  const reference = file.src?.trim() || file.path?.trim();
  return getFileKind(file) === "image" && Boolean(reference);
};

export const fileAttachmentToAsset = (
  file: FileAttachment,
): MessageAsset | null => {
  const href = file.src?.trim() || file.path?.trim();
  if (!href) return null;

  const label = file.title?.trim() || inferLinkLabel(href);
  let category: MessageAssetCategory = "document";
  if (isVideoFile(file)) category = "video";
  else if (isPhotoFile(file)) category = "photo";

  return {
    href,
    label,
    category,
    source: "file",
    previewSrc: category === "photo" ? href : undefined,
    path: file.path?.trim() || undefined,
    type: file.type?.trim() || undefined,
  };
};

export const partitionMessageAssets = (assets: MessageAsset[]) => {
  const documents: MessageAsset[] = [];
  const videos: MessageAsset[] = [];
  const photos: MessageAsset[] = [];
  const seen = new Set<string>();

  for (const asset of assets) {
    const key = normalizeHref(asset.href);
    if (seen.has(key)) continue;
    seen.add(key);

    if (asset.category === "video") videos.push(asset);
    else if (asset.category === "photo") photos.push(asset);
    else documents.push(asset);
  }

  return { documents, videos, photos };
};

export const extractMessageAssets = ({
  fileAttachments,
}: {
  htmlBody?: string | null;
  plainBody?: string | null;
  fileAttachments: FileAttachment[];
}): MessageAsset[] => {
  // Only real file attachments (MIME / uploads). Links already in the email
  // HTML stay in the body — do not mirror them under Documents & links.
  return fileAttachments
    .map(fileAttachmentToAsset)
    .filter((asset): asset is MessageAsset => asset != null);
};

/**
 * Previously used to remove Drive/Dropbox links from the email body after
 * extracting them into Documents. Kept for callers that still want that
 * behavior; ticket UI no longer strips body links (Gmail-like).
 */
export const collectStripHrefs = (assets: MessageAsset[]) =>
  assets
    .filter((asset) => asset.source === "link")
    .map((asset) => asset.href)
    .filter(Boolean);
