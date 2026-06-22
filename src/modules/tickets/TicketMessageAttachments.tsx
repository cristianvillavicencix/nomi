import { ExternalLink, FileText, Film } from "lucide-react";
import { PhotoLightboxGrid } from "@/components/ui/photo-lightbox-grid";
import { FileAttachmentPill } from "@/lib/fileAttachments";
import type { MessageAsset } from "@/modules/tickets/ticketMessageAssets";
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
        <FileAttachmentPill
          key={asset.href}
          file={{ title: asset.label, type: "", src: asset.href }}
        />
      ) : (
        <LinkAssetPill key={asset.href} asset={asset} />
      ),
    )}
  </div>
);

const PhotoGrid = ({ assets }: { assets: MessageAsset[] }) => (
  <PhotoLightboxGrid
    items={assets.map((asset) => ({
      id: asset.href,
      src: asset.previewSrc ?? asset.href,
      alt: asset.label,
      title: asset.label,
    }))}
    variant="gallery"
    showCaption
  />
);

export const TicketMessageAttachments = ({
  documents,
  videos,
  photos,
  className,
}: {
  documents: MessageAsset[];
  videos: MessageAsset[];
  photos: MessageAsset[];
  className?: string;
}) => {
  if (!documents.length && !videos.length && !photos.length) {
    return null;
  }

  return (
    <section
      aria-label="Message attachments"
      className={cn(
        "mt-4 space-y-4 border-t border-border/70 pt-4",
        className,
      )}
    >
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
          <PhotoGrid assets={photos} />
        </AssetSection>
      ) : null}
    </section>
  );
};
