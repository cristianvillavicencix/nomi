import { AlertCircle, Loader2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { FileTypeIcon } from "@/lib/fileAttachments";
import type { PendingTicketAttachment } from "@/modules/tickets/uploadTicketAttachment";
import { cn } from "@/lib/utils";

/** Gmail-style compact size: (713 K) / (1.2 M) */
const formatAttachmentSize = (bytes: number) => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} K`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} M`;
};

export const TicketPendingAttachmentItem = ({
  pending,
  disabled = false,
  onRemove,
  onRetry,
  sendAsDownloadLink = false,
}: {
  pending: PendingTicketAttachment;
  disabled?: boolean;
  onRemove: () => void;
  onRetry?: () => void;
  /** Large reply files are emailed as 7-day signed links. */
  sendAsDownloadLink?: boolean;
}) => {
  const isUploading = pending.status === "uploading";
  const isError = pending.status === "error";
  const isReady = pending.status === "ready";
  const fileMeta = {
    title: pending.file.name,
    type: pending.file.type,
  };

  return (
    <div
      className={cn(
        "w-full overflow-hidden rounded-sm bg-muted/70",
        isError && "bg-destructive/10",
      )}
    >
      <div className="flex min-h-9 items-center gap-2.5 px-2.5 py-1.5">
        {pending.previewUrl ? (
          <img
            src={pending.previewUrl}
            alt=""
            className="size-6 shrink-0 rounded-sm object-cover"
          />
        ) : (
          <FileTypeIcon file={fileMeta} className="size-5" />
        )}

        <div className="min-w-0 flex-1">
          <p className="truncate text-sm leading-snug">
            <span className="font-medium text-primary">{pending.file.name}</span>
            <span className="text-muted-foreground">
              {" "}
              ({formatAttachmentSize(pending.file.size)})
            </span>
          </p>
          {isUploading ? (
            <p className="mt-0.5 flex items-center gap-1 text-[11px] text-muted-foreground">
              <Loader2 className="size-3 animate-spin" />
              Uploading
              {pending.progress > 0 ? `… ${pending.progress}%` : "…"}
            </p>
          ) : null}
          {isError ? (
            <p className="mt-0.5 flex items-center gap-1 text-[11px] text-destructive">
              <AlertCircle className="size-3 shrink-0" />
              <span className="truncate">
                {pending.errorMessage ?? "Upload failed"}
              </span>
            </p>
          ) : null}
          {isReady && sendAsDownloadLink ? (
            <p className="mt-0.5 text-[11px] text-muted-foreground">
              Download link (7 days)
            </p>
          ) : null}
        </div>

        <div className="flex shrink-0 items-center gap-0.5">
          {isError && onRetry ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-7 px-1.5 text-[11px] text-destructive hover:bg-destructive/10 hover:text-destructive"
              disabled={disabled}
              onClick={onRetry}
            >
              Retry
            </Button>
          ) : null}
          <button
            type="button"
            className="inline-flex size-7 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-50"
            disabled={disabled || isUploading}
            onClick={onRemove}
            aria-label="Remove attachment"
          >
            <X className="size-4" />
          </button>
        </div>
      </div>

      {isUploading ? (
        <Progress
          value={pending.progress > 0 ? pending.progress : 8}
          className="h-0.5 rounded-none"
        />
      ) : null}
    </div>
  );
};
