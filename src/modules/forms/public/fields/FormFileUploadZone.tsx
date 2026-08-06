import { useRef, useState, type DragEvent } from "react";
import {
  FileIcon,
  FileVideo2,
  ImageIcon,
  Loader2,
  Plus,
  UploadCloud,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { UploadedFormFile } from "@/modules/forms/public/uploadFormFile";

const DEFAULT_ACCEPT_HINT = "Images, PDF, and video files";

const formatAcceptHint = (accept?: string) => {
  if (!accept?.trim()) return DEFAULT_ACCEPT_HINT;
  const normalized = accept.toLowerCase();
  if (normalized.includes("image") && normalized.includes("pdf")) {
    return "PNG, JPG, SVG, PDF, and WebP";
  }
  if (normalized.includes("image")) return "PNG, JPG, WebP, and other images";
  return DEFAULT_ACCEPT_HINT;
};

const isImageFile = (file: UploadedFormFile) => {
  const mime = file.mime_type ?? file.type ?? "";
  return (
    mime.startsWith("image/") ||
    /\.(png|jpe?g|gif|webp|svg|heic)$/i.test(file.name)
  );
};

const isVideoFile = (file: UploadedFormFile) => {
  const mime = file.mime_type ?? file.type ?? "";
  return (
    mime.startsWith("video/") || /\.(mp4|mov|webm)$/i.test(file.name)
  );
};

type FormFileUploadZoneProps = {
  id: string;
  accept?: string;
  multiple?: boolean;
  maxFiles?: number;
  files: UploadedFormFile[];
  disabled?: boolean;
  uploading?: boolean;
  uploadingCount?: number;
  onFilesSelected: (files: File[]) => void;
  onRemove?: (index: number) => void;
  emptyTitle?: string;
  emptySubtitle?: string;
  compact?: boolean;
};

export const FormFileUploadZone = ({
  id,
  accept,
  multiple = true,
  maxFiles = 20,
  files,
  disabled,
  uploading,
  uploadingCount = 0,
  onFilesSelected,
  onRemove,
  emptyTitle = "Drop files here",
  emptySubtitle = "or tap to browse from your device",
  compact = false,
}: FormFileUploadZoneProps) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const remaining = Math.max(0, maxFiles - files.length);
  const atLimit = remaining <= 0;
  const canAdd = !disabled && !uploading && !atLimit;

  const openPicker = () => {
    if (!canAdd) return;
    inputRef.current?.click();
  };

  const handleIncoming = (incoming: File[]) => {
    if (!incoming.length || !canAdd) return;
    onFilesSelected(incoming.slice(0, remaining));
  };

  const handleDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setIsDragging(false);
    handleIncoming(Array.from(event.dataTransfer.files ?? []));
  };

  const acceptHint = formatAcceptHint(accept);

  return (
    <div className="space-y-4">
      <input
        ref={inputRef}
        id={id}
        type="file"
        className="sr-only"
        multiple={multiple}
        accept={accept}
        disabled={!canAdd}
        onChange={(event) => {
          handleIncoming(Array.from(event.target.files ?? []));
          event.target.value = "";
        }}
      />

      {files.length > 0 ? (
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {files.map((file, index) => (
            <li
              key={file.path ?? file.url ?? `${file.name}-${index}`}
              className="group relative overflow-hidden rounded-xl border bg-muted/30"
            >
              <div className="aspect-[4/3] w-full">
                {isImageFile(file) ? (
                  <img
                    src={file.url}
                    alt={file.name}
                    className="size-full object-cover"
                    loading="lazy"
                  />
                ) : (
                  <div className="flex size-full flex-col items-center justify-center gap-2 bg-muted/50 p-3 text-center">
                    {isVideoFile(file) ? (
                      <FileVideo2 className="size-8 text-muted-foreground" />
                    ) : (
                      <FileIcon className="size-8 text-muted-foreground" />
                    )}
                    <span className="line-clamp-2 text-xs font-medium text-foreground">
                      {file.name}
                    </span>
                  </div>
                )}
              </div>
              {onRemove ? (
                <Button
                  type="button"
                  size="icon"
                  variant="secondary"
                  className="absolute right-2 top-2 size-8 rounded-full bg-background/90 shadow-sm opacity-100 sm:opacity-0 sm:group-hover:opacity-100"
                  disabled={disabled || uploading}
                  aria-label={`Remove ${file.name}`}
                  onClick={() => onRemove(index)}
                >
                  <X className="size-4" />
                </Button>
              ) : null}
              <div className="border-t bg-background/90 px-2 py-1.5">
                <p className="truncate text-xs text-muted-foreground">
                  {file.name}
                </p>
              </div>
            </li>
          ))}

          {canAdd ? (
            <li>
              <button
                type="button"
                className={cn(
                  "flex aspect-[4/3] w-full flex-col items-center justify-center gap-2 rounded-xl border border-dashed px-3 text-center transition-colors",
                  "border-muted-foreground/30 hover:border-primary/50 hover:bg-primary/5",
                )}
                onClick={openPicker}
              >
                <div className="flex size-10 items-center justify-center rounded-full bg-primary/10 text-primary">
                  <Plus className="size-5" />
                </div>
                <span className="text-xs font-medium">Add more</span>
              </button>
            </li>
          ) : null}
        </ul>
      ) : (
        <div
          role="button"
          tabIndex={canAdd ? 0 : -1}
          aria-disabled={!canAdd}
          className={cn(
            "relative flex w-full flex-col items-center justify-center rounded-2xl border-2 border-dashed px-4 text-center transition-colors",
            compact ? "min-h-40 py-6" : "min-h-52 py-8 sm:min-h-56",
            canAdd
              ? isDragging
                ? "border-primary bg-primary/5"
                : "border-muted-foreground/25 bg-muted/20 hover:border-primary/40 hover:bg-primary/5"
              : "cursor-not-allowed border-muted-foreground/20 bg-muted/10 opacity-70",
          )}
          onClick={openPicker}
          onKeyDown={(event) => {
            if (event.key === "Enter" || event.key === " ") {
              event.preventDefault();
              openPicker();
            }
          }}
          onDragEnter={(event) => {
            event.preventDefault();
            if (canAdd) setIsDragging(true);
          }}
          onDragOver={(event) => {
            event.preventDefault();
            if (canAdd) setIsDragging(true);
          }}
          onDragLeave={(event) => {
            event.preventDefault();
            if (event.currentTarget.contains(event.relatedTarget as Node))
              return;
            setIsDragging(false);
          }}
          onDrop={handleDrop}
        >
          <div className="flex size-14 items-center justify-center rounded-2xl bg-primary/10 text-primary sm:size-16">
            {uploading ? (
              <Loader2 className="size-7 animate-spin sm:size-8" />
            ) : (
              <UploadCloud className="size-7 sm:size-8" />
            )}
          </div>
          <p className="mt-4 text-base font-semibold text-foreground">
            {uploading
              ? uploadingCount > 1
                ? `Uploading ${uploadingCount} files…`
                : "Uploading…"
              : emptyTitle}
          </p>
          {!uploading ? (
            <>
              <p className="mt-1 max-w-sm text-sm text-muted-foreground">
                {emptySubtitle}
              </p>
              <p className="mt-3 text-xs text-muted-foreground">{acceptHint}</p>
              <p className="mt-1 text-xs text-muted-foreground">
                Up to {maxFiles} files
              </p>
            </>
          ) : null}
        </div>
      )}

      {files.length > 0 ? (
        <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
          <span>
            {files.length} of {maxFiles} file{maxFiles === 1 ? "" : "s"} added
          </span>
          {canAdd ? (
            <button
              type="button"
              className="inline-flex items-center gap-1 font-medium text-primary hover:underline"
              onClick={openPicker}
            >
              <ImageIcon className="size-3.5" />
              Add from gallery
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
};
