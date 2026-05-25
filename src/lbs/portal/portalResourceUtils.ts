import {
  formatServiceCategoryLabel,
  getProjectResourceCategoryLabel,
  parseServiceCategorySlug,
} from "@/lbs/deals/projectResourceConstants";
import type { PortalResource } from "@/lbs/portal/portalTypes";

export type PortalResourceFolder = {
  id: string;
  label: string;
  emoji: string;
  items: PortalResource[];
};

const folderEmoji = (folderId: string) => {
  if (folderId === "logo") return "🎨";
  if (folderId === "team") return "👥";
  if (folderId === "document") return "📄";
  if (folderId === "backup") return "💾";
  if (folderId.startsWith("service:")) return "📷";
  return "📁";
};

export const groupPortalResources = (
  resources: PortalResource[],
): PortalResourceFolder[] => {
  const buckets = new Map<string, PortalResource[]>();

  for (const resource of resources) {
    const category = resource.category || "other";
    const serviceSlug = parseServiceCategorySlug(category);
    const folderId = serviceSlug ? `service:${serviceSlug}` : category;
    const current = buckets.get(folderId) ?? [];
    current.push(resource);
    buckets.set(folderId, current);
  }

  const order = ["logo", "service-photo", "team", "document", "backup", "other"];
  const folders: PortalResourceFolder[] = [];

  for (const [folderId, items] of buckets.entries()) {
    const serviceSlug = parseServiceCategorySlug(folderId);
    const label = serviceSlug
      ? formatServiceCategoryLabel(serviceSlug)
      : getProjectResourceCategoryLabel(folderId);
    folders.push({
      id: folderId,
      label,
      emoji: folderEmoji(folderId),
      items: items.sort((a, b) =>
        String(a.file_name ?? a.label).localeCompare(String(b.file_name ?? b.label)),
      ),
    });
  }

  return folders.sort((left, right) => {
    const leftService = parseServiceCategorySlug(left.id);
    const rightService = parseServiceCategorySlug(right.id);
    if (leftService && !rightService) return 1;
    if (!leftService && rightService) return -1;
    const leftIndex = order.indexOf(left.id);
    const rightIndex = order.indexOf(right.id);
    return (
      (leftIndex === -1 ? 99 : leftIndex) - (rightIndex === -1 ? 99 : rightIndex)
    );
  });
};

export const estimatePortalStorageBytes = (resources: PortalResource[]) =>
  resources.reduce((total, entry) => total + (entry.size_bytes ?? 0), 0);

export const formatPortalStorage = (bytes: number) => {
  if (bytes <= 0) return "—";
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) {
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
};

export const parseDomainFromUrl = (siteUrl?: string | null) => {
  if (!siteUrl?.trim()) return "";
  try {
    const href = siteUrl.startsWith("http") ? siteUrl : `https://${siteUrl}`;
    return new URL(href).hostname.replace(/^www\./, "");
  } catch {
    return siteUrl.replace(/^https?:\/\//, "").replace(/^www\./, "").split("/")[0];
  }
};
