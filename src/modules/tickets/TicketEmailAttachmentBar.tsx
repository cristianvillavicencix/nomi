import { File, FileText } from "lucide-react";
import { useState } from "react";
import { getFileKind } from "@/lib/fileAttachments";
import type { MessageAsset } from "@/modules/tickets/ticketMessageAssets";
import {
  downloadTicketAssets,
  isDownloadableFileAsset,
  openTicketAsset,
} from "@/modules/tickets/downloadTicketAssets";
import { cn } from "@/lib/utils";

const formatBytes = (size: number | null | undefined) => {
  if (size == null || size <= 0) return "";
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(0)} KB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
};

const AttachmentChip = ({ asset }: { asset: MessageAsset }) => {
  const [isDownloading, setIsDownloading] = useState(false);
  const kind = getFileKind({
    title: asset.label,
    type: asset.type,
    src: asset.href,
    path: asset.path,
  });
  const Icon = kind === "pdf" ? FileText : File;

  return (
    <button
      type="button"
      title={asset.label}
      disabled={!isDownloadableFileAsset(asset) || isDownloading}
      onClick={(event) => {
        event.stopPropagation();
        if (!isDownloadableFileAsset(asset)) return;
        setIsDownloading(true);
        void openTicketAsset(asset).finally(() => setIsDownloading(false));
      }}
      className="inline-flex max-w-full items-center gap-2 rounded-md border border-border/80 bg-muted/40 px-2.5 py-1.5 text-left text-xs text-foreground transition-colors hover:bg-muted/70 disabled:opacity-60"
    >
      <Icon
        className={cn(
          "size-4 shrink-0",
          kind === "pdf" ? "text-red-600" : "text-muted-foreground",
        )}
      />
      <span className="min-w-0 truncate font-medium">{asset.label}</span>
      {asset.sizeBytes ? (
        <span className="shrink-0 tabular-nums text-muted-foreground">
          {formatBytes(asset.sizeBytes)}
        </span>
      ) : null}
    </button>
  );
};

export const TicketEmailAttachmentBar = ({
  assets,
  className,
}: {
  assets: MessageAsset[];
  className?: string;
}) => {
  const [isDownloadingAll, setIsDownloadingAll] = useState(false);
  const downloadable = assets.filter(isDownloadableFileAsset);

  if (!downloadable.length) return null;

  const handleDownloadAll = () => {
    setIsDownloadingAll(true);
    void downloadTicketAssets(downloadable).finally(() =>
      setIsDownloadingAll(false),
    );
  };

  return (
    <div className={cn("mb-3 space-y-2", className)}>
      <div className="flex flex-wrap gap-2">
        {downloadable.map((asset) => (
          <AttachmentChip key={asset.href} asset={asset} />
        ))}
      </div>
      {downloadable.length > 1 ? (
        <button
          type="button"
          disabled={isDownloadingAll}
          onClick={handleDownloadAll}
          className="text-xs font-medium text-muted-foreground underline-offset-2 hover:text-foreground hover:underline disabled:opacity-60"
        >
          Download all ({downloadable.length})
        </button>
      ) : null}
    </div>
  );
};
