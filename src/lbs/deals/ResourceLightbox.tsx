import { useEffect, useState } from "react";
import { Download, ExternalLink } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  getProjectResourceCategoryLabel,
  isImageResource,
  type ProjectResourceFile,
} from "@/lbs/deals/projectResourceConstants";
import { formatResourceDate } from "@/lbs/deals/projectResourceGrouping";
import { getProjectResourceSignedUrl } from "@/lbs/deals/projectResourceUpload";
import type { DealResource } from "@/lbs/types";

type ResourceLightboxProps = {
  resource: DealResource | null;
  onClose: () => void;
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

export const ResourceLightbox = ({ resource, onClose }: ResourceLightboxProps) => {
  const [fileUrl, setFileUrl] = useState("");
  const [loadingUrl, setLoadingUrl] = useState(false);

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

  if (!resource) return null;

  const file = resource.file;
  const title = resource.label?.trim() || file.title;
  const isImage = isImageResource(file.type);
  const previewUrl = fileUrl || file.src;

  return (
    <Dialog open={Boolean(resource)} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-4xl gap-4 p-0 overflow-hidden">
        <DialogHeader className="space-y-3 px-6 pt-6">
          <DialogTitle className="pr-8">{title}</DialogTitle>
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
            {resource.created_at ? (
              <span className="text-muted-foreground">
                {formatResourceDate(resource.created_at)}
              </span>
            ) : null}
          </div>
        </DialogHeader>

        <div className="bg-muted/30 px-6 pb-2">
          {loadingUrl ? (
            <div className="flex min-h-48 items-center justify-center text-sm text-muted-foreground">
              Loading preview…
            </div>
          ) : isImage && previewUrl ? (
            <img
              src={previewUrl}
              alt={title}
              className="mx-auto max-h-[70vh] w-auto max-w-full rounded-md object-contain"
            />
          ) : (
            <div className="flex min-h-48 flex-col items-center justify-center gap-3 rounded-md border bg-background p-8 text-center">
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

        <div className="flex justify-end gap-2 px-6 pb-6">
          {previewUrl ? (
            <Button type="button" variant="outline" asChild>
              <a href={previewUrl} download={file.title} target="_blank" rel="noreferrer">
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
