import { AlertCircle, CheckCircle2, Loader2, Paperclip, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { IconButton } from "@/components/ui/icon-button";
import { Progress } from "@/components/ui/progress";
import type { PendingTicketAttachment } from "@/modules/tickets/uploadTicketAttachment";
import { cn } from "@/lib/utils";

const formatFileSize = (bytes: number) => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
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

  return (
    <div
      className={cn(
        "w-full min-w-[220px] max-w-sm rounded-md border px-2.5 py-2 text-xs",
        isError
          ? "border-destructive/50 bg-destructive/5"
          : "border-border bg-muted/30",
      )}
    >
      <div className="flex items-start gap-2">
        {pending.previewUrl ? (
          <img
            src={pending.previewUrl}
            alt=""
            className="mt-0.5 size-8 shrink-0 rounded object-cover"
          />
        ) : (
          <Paperclip className="mt-1 size-3.5 shrink-0 text-muted-foreground" />
        )}

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="truncate font-medium">{pending.file.name}</span>
            <span className="shrink-0 text-muted-foreground">
              {formatFileSize(pending.file.size)}
            </span>
          </div>

          {isUploading ? (
            <div className="mt-2 space-y-1.5">
              <Progress
                value={pending.progress > 0 ? pending.progress : 8}
                className="h-1.5"
              />
              <p className="flex items-center gap-1.5 text-muted-foreground">
                <Loader2 className="size-3 animate-spin" />
                Uploading
                {pending.progress > 0 ? `… ${pending.progress}%` : "…"}
              </p>
            </div>
          ) : null}

          {isError ? (
            <p className="mt-1.5 flex items-start gap-1.5 text-destructive">
              <AlertCircle className="mt-0.5 size-3.5 shrink-0" />
              <span>{pending.errorMessage ?? "Upload failed"}</span>
            </p>
          ) : null}

          {isReady ? (
            <p className="mt-1.5 flex items-center gap-1.5 text-emerald-700 dark:text-emerald-600">
              <CheckCircle2 className="size-3.5 shrink-0" />
              {sendAsDownloadLink
                ? "Ready · download link (7 days)"
                : "Ready to send"}
            </p>
          ) : null}
        </div>

        <div className="flex shrink-0 items-center gap-1">
          {isError && onRetry ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-6 px-1.5 text-[11px] text-destructive hover:bg-destructive/10 hover:text-destructive"
              disabled={disabled}
              onClick={onRetry}
            >
              Retry
            </Button>
          ) : null}
          <IconButton
            className="size-6 min-h-6 min-w-6"
            disabled={disabled || isUploading}
            onClick={onRemove}
            aria-label="Remove attachment"
          >
            <X className="size-3.5" />
          </IconButton>
        </div>
      </div>
    </div>
  );
};
