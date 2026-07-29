import { Download, ExternalLink, FileText, Film } from "lucide-react";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { IconButton } from "@/components/ui/icon-button";
import {
  PhotoLightboxGrid,
  type PhotoLightboxGridItem,
} from "@/components/ui/photo-lightbox-grid";
import { useStorageSignedUrls } from "@/hooks/useStorageSignedUrls";
import { FileAttachmentPill } from "@/lib/fileAttachments";
import type { MessageAsset } from "@/modules/tickets/ticketMessageAssets";
import {
  downloadTicketAsset,
  downloadTicketAssets,
  isDownloadableFileAsset,
} from "@/modules/tickets/downloadTicketAssets";
import { cn } from "@/lib/utils";

const LinkAssetPill = ({ asset }: { asset: MessageAsset }) => {
  const Icon =
    asset.category === "video"
      ? Film
      : asset.source === "link"
        ? ExternalLink
        : FileText;

  return (
    <a
      href={asset.href}
      target="_blank"
      rel="noopener noreferrer"
      title={asset.label}
      className="inline-flex max-w-full items-center gap-1.5 rounded-full border bg-background px-2.5 py-1 text-xs font-medium text-foreground transition-colors hover:bg-muted/50"
      onClick={(event) => event.stopPropagation()}
    >
      <Icon className="size-3.5 shrink-0 text-muted-foreground" />
      <span className="truncate">{asset.label}</span>
    </a>
  );
};

const AssetSection = ({
  title,
  children,
  className,
}: {
  title: string;
  children: React.ReactNode;
  className?: string;
}) => (
  <div className={cn("space-y-2", className)}>
    <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
      {title}
    </p>
    {children}
  </div>
);

const DocumentRow = ({ assets }: { assets: MessageAsset[] }) => (
  <div className="flex flex-wrap gap-2">
    {assets.map((asset) =>
      asset.source === "file" ? (
        <FileAssetRow key={asset.href} asset={asset} />
      ) : (
        <LinkAssetPill key={asset.href} asset={asset} />
      ),
    )}
  </div>
);

const FileAssetRow = ({ asset }: { asset: MessageAsset }) => {
  const [isDownloading, setIsDownloading] = useState(false);

  return (
    <div className="inline-flex max-w-full items-center gap-1 rounded-full border bg-background pr-1">
      <FileAttachmentPill
        file={{
          title: asset.label,
          type: asset.type ?? "",
          src: asset.href,
          path: asset.path,
        }}
      />
      {isDownloadableFileAsset(asset) ? (
        <IconButton
          className="size-7 shrink-0 rounded-full"
          disabled={isDownloading}
          aria-label={`Download ${asset.label}`}
          onClick={(event) => {
            event.preventDefault();
            event.stopPropagation();
            setIsDownloading(true);
            void downloadTicketAsset(asset).finally(() =>
              setIsDownloading(false),
            );
          }}
        >
          <Download className="size-3.5" />
        </IconButton>
      ) : null}
    </div>
  );
};

const PhotoGrid = ({
  assets,
  onDownload,
}: {
  assets: MessageAsset[];
  onDownload?: (asset: MessageAsset) => void;
}) => {
  const storageRefs = useMemo(
    () => assets.map((asset) => asset.previewSrc ?? asset.href),
    [assets],
  );
  const signedUrls = useStorageSignedUrls(storageRefs, {
    defaultBucket: "attachments",
  });

  const items = useMemo(() => {
    const resolved: PhotoLightboxGridItem[] = [];
    assets.forEach((asset, index) => {
      const src = signedUrls[index];
      if (!src) return;
      resolved.push({
        id: asset.href,
        src,
        alt: asset.label,
        title: asset.label,
      });
    });
    return resolved;
  }, [assets, signedUrls]);

  if (!items.length && assets.length > 0) {
    return <p className="text-xs text-muted-foreground">Loading photos…</p>;
  }

  return (
    <PhotoLightboxGrid
      items={items}
      variant="gallery"
      showCaption
      onDownloadItem={
        onDownload
          ? (item) => {
              const asset = assets.find((entry) => entry.href === item.id);
              if (asset) onDownload(asset);
            }
          : undefined
      }
    />
  );
};

export const TicketMessageAttachments = ({
  documents,
  videos,
  photos,
  className,
  showSectionDownloadAll = true,
}: {
  documents: MessageAsset[];
  videos: MessageAsset[];
  photos: MessageAsset[];
  className?: string;
  showSectionDownloadAll?: boolean;
}) => {
  const [isDownloadingAll, setIsDownloadingAll] = useState(false);

  if (!documents.length && !videos.length && !photos.length) {
    return null;
  }

  const allAssets = [...documents, ...videos, ...photos];
  const downloadableCount = allAssets.filter(isDownloadableFileAsset).length;

  const handleDownloadAll = async () => {
    setIsDownloadingAll(true);
    try {
      await downloadTicketAssets(allAssets);
    } finally {
      setIsDownloadingAll(false);
    }
  };

  const handlePhotoDownload = (asset: MessageAsset) => {
    void downloadTicketAsset(asset);
  };

  return (
    <section
      aria-label="Message attachments"
      className={cn("mt-4 space-y-4 border-t border-border/70 pt-4", className)}
    >
      {showSectionDownloadAll && downloadableCount > 1 ? (
        <div className="flex justify-end">
          <Button
            type="button"
            size="sm"
            variant="secondary"
            className="h-8"
            disabled={isDownloadingAll}
            onClick={() => void handleDownloadAll()}
          >
            <Download className="size-3.5" />
            Download all ({downloadableCount})
          </Button>
        </div>
      ) : null}
      {documents.length > 0 ? (
        <AssetSection title="Documents & links">
          <DocumentRow assets={documents} />
        </AssetSection>
      ) : null}

      {videos.length > 0 ? (
        <AssetSection title="Videos">
          <div className="flex flex-wrap gap-2">
            {videos.map((asset) => (
              <LinkAssetPill key={asset.href} asset={asset} />
            ))}
          </div>
        </AssetSection>
      ) : null}

      {photos.length > 0 ? (
        <AssetSection title="Photos">
          <PhotoGrid
            assets={photos}
            onDownload={
              photos.some(isDownloadableFileAsset)
                ? handlePhotoDownload
                : undefined
            }
          />
        </AssetSection>
      ) : null}
    </section>
  );
};
