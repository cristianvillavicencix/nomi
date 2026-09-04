import { useEffect, useRef, useState, type DragEvent } from "react";
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

type PendingPreview = {
  id: string;
  name: string;
  previewUrl: string;
  isImage: boolean;
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
  const pendingRef = useRef<PendingPreview[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [pending, setPending] = useState<PendingPreview[]>([]);
  const remaining = Math.max(0, maxFiles - files.length);
  const atLimit = remaining <= 0;
  const canAdd = !disabled && !uploading && !atLimit;
  const isSingleSlot = maxFiles === 1;
  const singleFile = files[0];
  const singlePending = pending[0];
  const showSinglePreview =
    isSingleSlot && (Boolean(singleFile) || Boolean(singlePending));
  const showMultiGrid =
    !isSingleSlot && (files.length > 0 || pending.length > 0);
  const showFooter = showSinglePreview || showMultiGrid;

  const openPicker = () => {
    if (!canAdd) return;
    inputRef.current?.click();
  };

  const clearPending = (entries: PendingPreview[]) => {
    for (const entry of entries) {
      URL.revokeObjectURL(entry.previewUrl);
    }
  };

  const replacePending = (next: PendingPreview[]) => {
    clearPending(pendingRef.current);
    pendingRef.current = next;
    setPending(next);
  };

  useEffect(() => {
    if (uploading) return;
    if (pendingRef.current.length === 0) return;
    clearPending(pendingRef.current);
    pendingRef.current = [];
    setPending([]);
  }, [uploading, files.length]);

  useEffect(
    () => () => {
      clearPending(pendingRef.current);
      pendingRef.current = [];
    },
    [],
  );

  const handleIncoming = (incoming: File[]) => {
    if (!incoming.length || !canAdd) return;
    const batch = incoming.slice(0, remaining);
    replacePending(
      batch.map((file, index) => ({
        id: `${file.name}-${file.size}-${file.lastModified}-${index}`,
        name: file.name,
        previewUrl: URL.createObjectURL(file),
        isImage:
          file.type.startsWith("image/") ||
          /\.(png|jpe?g|gif|webp|heic)$/i.test(file.name),
      })),
    );
    onFilesSelected(batch);
  };

  const handleDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setIsDragging(false);
    handleIncoming(Array.from(event.dataTransfer.files ?? []));
  };

  const acceptHint = formatAcceptHint(accept);
  const frameHeight = compact ? "min-h-40" : "min-h-52 sm:min-h-56";

  return (
    <div className="space-y-3">
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

      {showSinglePreview ? (
        <div
          className={cn(
            "relative w-full overflow-hidden rounded-2xl border bg-muted/30",
            frameHeight,
          )}
        >
          {singlePending ? (
            <>
              {singlePending.isImage ? (
                <img
                  src={singlePending.previewUrl}
                  alt={singlePending.name}
                  className="absolute inset-0 size-full object-cover opacity-80"
                />
              ) : (
                <div className="absolute inset-0 flex items-center justify-center bg-muted/50">
                  <FileIcon className="size-10 text-muted-foreground" />
                </div>
              )}
              <div className="absolute inset-0 flex items-center justify-center bg-background/35">
                <Loader2 className="size-7 animate-spin text-primary" />
              </div>
              <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/60 to-transparent px-3 py-2.5">
                <p className="truncate text-xs font-medium text-white">
                  {singlePending.name}
                </p>
              </div>
            </>
          ) : singleFile ? (
            <>
              {isImageFile(singleFile) && singleFile.url ? (
                <img
                  src={singleFile.url}
                  alt={singleFile.name}
                  className="absolute inset-0 size-full object-cover"
                />
              ) : (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-muted/50 p-4 text-center">
                  {isVideoFile(singleFile) ? (
                    <FileVideo2 className="size-10 text-muted-foreground" />
                  ) : (
                    <FileIcon className="size-10 text-muted-foreground" />
                  )}
                  <p className="line-clamp-2 text-sm font-medium text-foreground">
                    {singleFile.name}
                  </p>
                </div>
              )}
              {onRemove ? (
                <Button
                  type="button"
                  size="icon"
                  variant="secondary"
                  className="absolute right-2 top-2 size-8 rounded-full bg-background/95 shadow-sm"
                  disabled={disabled || uploading}
                  aria-label={`Remove ${singleFile.name}`}
                  onClick={() => onRemove(0)}
                >
                  <X className="size-4" />
                </Button>
              ) : null}
              <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/60 to-transparent px-3 py-2.5">
                <p className="truncate text-xs font-medium text-white">
                  {singleFile.name}
                </p>
              </div>
            </>
          ) : null}
        </div>
      ) : showMultiGrid ? (
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
          {files.map((file, index) => (
            <li
              key={file.path ?? file.url ?? `${file.name}-${index}`}
              className="group relative overflow-hidden rounded-xl border bg-background"
            >
              <div className="relative aspect-square w-full bg-muted/40">
                {isImageFile(file) && file.url ? (
                  <img
                    src={file.url}
                    alt={file.name}
                    className="size-full object-cover"
                    loading="lazy"
                  />
                ) : (
                  <div className="flex size-full flex-col items-center justify-center gap-1.5 p-2 text-center">
                    {isVideoFile(file) ? (
                      <FileVideo2 className="size-7 text-muted-foreground" />
                    ) : (
                      <FileIcon className="size-7 text-muted-foreground" />
                    )}
                  </div>
                )}
                {onRemove ? (
                  <Button
                    type="button"
                    size="icon"
                    variant="secondary"
                    className="absolute right-1.5 top-1.5 size-7 rounded-full bg-background/95 shadow-sm"
                    disabled={disabled || uploading}
                    aria-label={`Remove ${file.name}`}
                    onClick={() => onRemove(index)}
                  >
                    <X className="size-3.5" />
                  </Button>
                ) : null}
              </div>
              <div className="border-t px-2 py-1.5">
                <p
                  className="truncate text-xs font-medium text-foreground"
                  title={file.name}
                >
                  {file.name}
                </p>
              </div>
            </li>
          ))}

          {pending.map((entry) => (
            <li
              key={entry.id}
              className="relative overflow-hidden rounded-xl border border-primary/30 bg-background"
            >
              <div className="relative aspect-square w-full bg-muted/40">
                {entry.isImage ? (
                  <img
                    src={entry.previewUrl}
                    alt={entry.name}
                    className="size-full object-cover opacity-70"
                  />
                ) : (
                  <div className="flex size-full items-center justify-center">
                    <FileIcon className="size-7 text-muted-foreground" />
                  </div>
                )}
                <div className="absolute inset-0 flex items-center justify-center bg-background/35">
                  <Loader2 className="size-6 animate-spin text-primary" />
                </div>
              </div>
              <div className="border-t px-2 py-1.5">
                <p
                  className="truncate text-xs font-medium text-foreground"
                  title={entry.name}
                >
                  {entry.name}
                </p>
              </div>
            </li>
          ))}

          {canAdd ? (
            <li>
              <button
                type="button"
                className={cn(
                  "flex h-full min-h-[7.5rem] w-full flex-col items-center justify-center gap-2 rounded-xl border border-dashed px-3 py-4 text-center transition-colors",
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
                Up to {maxFiles} file{maxFiles === 1 ? "" : "s"}
              </p>
            </>
          ) : null}
        </div>
      )}

      {showFooter && !isSingleSlot ? (
        <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
          <span>
            {uploading
              ? uploadingCount > 1
                ? `Uploading ${uploadingCount} photos…`
                : "Uploading…"
              : `${files.length} of ${maxFiles} photo${maxFiles === 1 ? "" : "s"}`}
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
