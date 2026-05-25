import { useMemo, useState } from "react";
import { zipSync } from "fflate";
import { Download, FileIcon, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import type { PortalCopy } from "@/lbs/portal/portalI18n";
import { ResourceLightbox } from "@/lbs/deals/ResourceLightbox";
import type { DealResource } from "@/lbs/types";
import {
  formatPortalStorage,
  groupPortalResources,
} from "@/lbs/portal/portalResourceUtils";
import type { PortalResource } from "@/lbs/portal/portalTypes";

const sanitizeFilename = (value: string) =>
  value.replace(/[/\\?%*:|"<>]/g, "-").trim() || "file";

const toLightboxResource = (entry: PortalResource): DealResource => ({
  id: entry.id,
  deal_id: 0,
  category: entry.category,
  label: entry.label ?? entry.file_name ?? "File",
  file: {
    title: entry.file_name ?? entry.label ?? "file",
    type: entry.mime_type ?? "application/octet-stream",
    path: "",
    src: entry.preview_url ?? entry.download_url ?? "",
  },
});

export const ClientFilesSection = ({
  resources,
  copy,
}: {
  resources: PortalResource[];
  copy: PortalCopy;
}) => {
  const [query, setQuery] = useState("");
  const [downloadingFolder, setDownloadingFolder] = useState<string | null>(null);
  const [preview, setPreview] = useState<DealResource | null>(null);
  const [gallery, setGallery] = useState<DealResource[]>([]);

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return resources;
    return resources.filter((entry) =>
      [entry.file_name, entry.label, entry.category]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(needle)),
    );
  }, [query, resources]);

  const folders = useMemo(() => groupPortalResources(filtered), [filtered]);
  const storageLabel = formatPortalStorage(
    resources.reduce((total, entry) => total + (entry.size_bytes ?? 0), 0),
  );

  const downloadFolderZip = async (folderId: string, items: PortalResource[]) => {
    setDownloadingFolder(folderId);
    try {
      const zipEntries: Record<string, Uint8Array> = {};
      const usedNames = new Map<string, number>();

      for (const entry of items) {
        const url = entry.download_url;
        if (!url) continue;
        const response = await fetch(url);
        if (!response.ok) continue;
        const bytes = new Uint8Array(await response.arrayBuffer());
        const baseName = sanitizeFilename(
          entry.file_name ?? entry.label ?? `file-${entry.id}`,
        );
        const count = usedNames.get(baseName) ?? 0;
        usedNames.set(baseName, count + 1);
        const filename =
          count === 0
            ? baseName
            : baseName.replace(/(\.[^.]+)?$/, `-${count + 1}$1`);
        zipEntries[filename] = bytes;
      }

      if (Object.keys(zipEntries).length === 0) {
        throw new Error(copy.filesDownloadError);
      }

      const zipped = zipSync(zipEntries);
      const blob = new Blob([zipped], { type: "application/zip" });
      const objectUrl = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = objectUrl;
      anchor.download = `${sanitizeFilename(folderId)}.zip`;
      anchor.click();
      URL.revokeObjectURL(objectUrl);
    } finally {
      setDownloadingFolder(null);
    }
  };

  const openPreview = (entry: PortalResource, imageItems: PortalResource[]) => {
    const mapped = imageItems.map(toLightboxResource);
    setGallery(mapped);
    setPreview(toLightboxResource(entry));
  };

  if (resources.length === 0) {
    return (
      <p className="rounded-md border border-dashed p-4 text-sm text-muted-foreground">
        {copy.noSharedFiles}
      </p>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-muted-foreground">{copy.filesIntro}</p>
        <div className="text-xs text-muted-foreground">
          {copy.storageUsed}: {storageLabel}
        </div>
      </div>

      <div className="relative">
        <Search className="pointer-events-none absolute top-2.5 left-3 size-4 text-muted-foreground" />
        <Input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder={copy.filesSearchPlaceholder}
          className="pl-9"
        />
      </div>

      <Accordion type="multiple" className="space-y-2">
        {folders.map((folder) => (
          <AccordionItem
            key={folder.id}
            value={folder.id}
            className="rounded-lg border px-4"
          >
            <AccordionTrigger className="hover:no-underline">
              <div className="flex flex-1 items-center justify-between gap-3 pr-2 text-left">
                <span className="font-medium text-[#0D3B6E]">
                  {folder.emoji} {folder.label}{" "}
                  <span className="text-muted-foreground">
                    ({folder.items.length})
                  </span>
                </span>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={downloadingFolder === folder.id}
                  onClick={(event) => {
                    event.stopPropagation();
                    void downloadFolderZip(folder.id, folder.items);
                  }}
                >
                  <Download className="size-4" />
                  {copy.downloadFolderZip}
                </Button>
              </div>
            </AccordionTrigger>
            <AccordionContent className="pb-4">
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {folder.items.map((entry) => {
                  const imageItems = folder.items.filter((item) => item.is_image);
                  return (
                    <div
                      key={entry.id}
                      className="overflow-hidden rounded-lg border bg-background"
                    >
                      {entry.is_image && entry.preview_url ? (
                        <button
                          type="button"
                          className="block w-full"
                          onClick={() => openPreview(entry, imageItems)}
                        >
                          <img
                            src={entry.preview_url}
                            alt={entry.file_name ?? entry.label ?? "Image"}
                            className="aspect-video w-full object-cover"
                          />
                        </button>
                      ) : (
                        <div className="flex aspect-video items-center justify-center bg-muted/40">
                          <FileIcon className="size-8 text-muted-foreground" />
                        </div>
                      )}
                      <div className="space-y-2 p-3">
                        <div className="truncate text-sm font-medium">
                          {entry.file_name ?? entry.label ?? copy.fileFallback}
                        </div>
                        {entry.download_url ? (
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            className="w-full"
                            asChild
                          >
                            <a href={entry.download_url} download target="_blank" rel="noreferrer">
                              <Download className="size-4" />
                              {copy.downloadFile}
                            </a>
                          </Button>
                        ) : null}
                      </div>
                    </div>
                  );
                })}
              </div>
            </AccordionContent>
          </AccordionItem>
        ))}
      </Accordion>

      <ResourceLightbox
        resources={gallery}
        resource={preview}
        onClose={() => setPreview(null)}
        onNavigate={setPreview}
      />
    </div>
  );
};
