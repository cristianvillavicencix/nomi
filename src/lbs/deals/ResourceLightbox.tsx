import { useCallback, useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, Download, ExternalLink } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { exportFaviconPack } from "@/lbs/deals/projectResourceImageOptimize";
import {
  getProjectResourceCategoryLabel,
  isImageResource,
  type ProjectResourceFile,
} from "@/lbs/deals/projectResourceConstants";
import { formatResourceDate } from "@/lbs/deals/projectResourceGrouping";
import { getProjectResourceSignedUrl } from "@/lbs/deals/projectResourceUpload";
import type { DealResource } from "@/lbs/types";

type ResourceLightboxProps = {
  resources: DealResource[];
  resource: DealResource | null;
  onClose: () => void;
  onNavigate: (resource: DealResource) => void;
};

const resolveResourceUrl = async (file: ProjectResourceFile) => {
  const bucket = file.bucket ?? "project-files";
  if (bucket === "attachments" && file.src) {
    return file.src;
  }
  if (file.path) {
    return getProjectResourceSignedUrl(file.path, bucket);
  }
  return file.src;
};

export const ResourceLightbox = ({
  resources,
  resource,
  onClose,
  onNavigate,
}: ResourceLightboxProps) => {
  const [fileUrl, setFileUrl] = useState("");
  const [loadingUrl, setLoadingUrl] = useState(false);
  const [busyAction, setBusyAction] = useState<string | null>(null);

  const imageResources = useMemo(
    () =>
      resources.filter((entry) => isImageResource(entry.file?.type ?? "")),
    [resources],
  );

  const currentIndex = useMemo(() => {
    if (!resource) return -1;
    return imageResources.findIndex((entry) => entry.id === resource.id);
  }, [imageResources, resource]);

  const hasPrev = currentIndex > 0;
  const hasNext =
    currentIndex >= 0 && currentIndex < imageResources.length - 1;

  const goPrev = useCallback(() => {
    if (!hasPrev) return;
    onNavigate(imageResources[currentIndex - 1]);
  }, [currentIndex, hasPrev, imageResources, onNavigate]);

  const goNext = useCallback(() => {
    if (!hasNext) return;
    onNavigate(imageResources[currentIndex + 1]);
  }, [currentIndex, hasNext, imageResources, onNavigate]);

  useEffect(() => {
    if (!resource?.file) {
      setFileUrl("");
      return;
    }

    let cancelled = false;
    setLoadingUrl(true);
    resolveResourceUrl(resource.file)
      .then((url) => {
        if (!cancelled) setFileUrl(url);
      })
      .catch(() => {
        if (!cancelled) setFileUrl(resource.file.src ?? "");
      })
      .finally(() => {
        if (!cancelled) setLoadingUrl(false);
      });

    return () => {
      cancelled = true;
    };
  }, [resource]);

  useEffect(() => {
    if (!resource) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "ArrowLeft") {
        event.preventDefault();
        goPrev();
      }
      if (event.key === "ArrowRight") {
        event.preventDefault();
        goNext();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [goNext, goPrev, resource]);

  if (!resource) return null;

  const file = resource.file;
  const title = resource.label?.trim() || file.title;
  const isImage = isImageResource(file.type);
  const previewUrl = fileUrl || file.src;
  const isLogoTab = resource.category === "logo";

  return (
    <Dialog
      open={Boolean(resource)}
      onOpenChange={(open) => !open && onClose()}
    >
      <DialogContent
        className={cn(
          "flex h-[min(92vh,920px)] w-[min(96vw,1120px)] max-w-[96vw] flex-col gap-0 overflow-hidden p-0",
          "sm:max-w-[96vw]",
        )}
      >
        <DialogHeader className="shrink-0 space-y-3 border-b px-6 py-4 text-left">
          <DialogTitle className="pr-10 text-base sm:text-lg">{title}</DialogTitle>
          <div className="flex flex-wrap items-center gap-2 text-sm font-normal">
            <Badge variant="secondary">
              {getProjectResourceCategoryLabel(resource.category)}
            </Badge>
            <Badge variant="outline" className="capitalize">
              {resource.source ?? "team"}
            </Badge>
            {resource.visibility ? (
              <Badge variant="outline" className="capitalize">
                {resource.visibility}
              </Badge>
            ) : null}
            {imageResources.length > 1 && currentIndex >= 0 ? (
              <span className="text-muted-foreground">
                {currentIndex + 1} / {imageResources.length}
              </span>
            ) : null}
            {resource.created_at ? (
              <span className="text-muted-foreground">
                {formatResourceDate(resource.created_at)}
              </span>
            ) : null}
          </div>
        </DialogHeader>

        <div className="relative min-h-0 flex-1 bg-[linear-gradient(45deg,hsl(var(--muted)/0.45)_25%,transparent_25%,transparent_75%,hsl(var(--muted)/0.45)_75%,hsl(var(--muted)/0.45)),linear-gradient(45deg,hsl(var(--muted)/0.45)_25%,transparent_25%,transparent_75%,hsl(var(--muted)/0.45)_75%,hsl(var(--muted)/0.45))] bg-[length:20px_20px] bg-[position:0_0,10px_10px]">
          {imageResources.length > 1 ? (
            <>
              <Button
                type="button"
                size="icon"
                variant="secondary"
                className="absolute left-3 top-1/2 z-10 -translate-y-1/2 rounded-full shadow-md"
                disabled={!hasPrev}
                onClick={goPrev}
              >
                <ChevronLeft className="size-5" />
                <span className="sr-only">Previous image</span>
              </Button>
              <Button
                type="button"
                size="icon"
                variant="secondary"
                className="absolute right-3 top-1/2 z-10 -translate-y-1/2 rounded-full shadow-md"
                disabled={!hasNext}
                onClick={goNext}
              >
                <ChevronRight className="size-5" />
                <span className="sr-only">Next image</span>
              </Button>
            </>
          ) : null}

          <div className="flex h-full w-full items-center justify-center p-4 sm:px-14 sm:py-6">
            {loadingUrl ? (
              <p className="text-sm text-muted-foreground">Loading preview…</p>
            ) : isImage && previewUrl ? (
              <img
                src={previewUrl}
                alt={title}
                className="block max-h-full max-w-full object-contain"
                style={{ width: "auto", height: "auto" }}
              />
            ) : (
              <div className="flex max-w-sm flex-col items-center justify-center gap-3 rounded-md border bg-background/90 p-8 text-center shadow-sm">
                <p className="text-sm text-muted-foreground">{file.title}</p>
                {previewUrl ? (
                  <Button type="button" variant="outline" asChild>
                    <a href={previewUrl} target="_blank" rel="noreferrer">
                      <ExternalLink className="size-4" />
                      Open file
                    </a>
                  </Button>
                ) : null}
              </div>
            )}
          </div>
        </div>

        <div className="flex shrink-0 flex-wrap justify-end gap-2 border-t px-6 py-4">
          {isLogoTab && isImage && previewUrl ? (
            <Button
              type="button"
              variant="outline"
              disabled={busyAction != null}
              onClick={() => {
                setBusyAction("favicon");
                void exportFaviconPack(previewUrl, title).finally(() =>
                  setBusyAction(null),
                );
              }}
            >
              Export favicon PNGs
            </Button>
          ) : null}
          {previewUrl ? (
            <Button type="button" variant="outline" asChild>
              <a
                href={previewUrl}
                download={file.title}
                target="_blank"
                rel="noreferrer"
              >
                <Download className="size-4" />
                Download
              </a>
            </Button>
          ) : null}
        </div>
      </DialogContent>
    </Dialog>
  );
};
