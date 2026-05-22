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
} from "@/lbs/deals/projectResourceConstants";
import { formatResourceDate } from "@/lbs/deals/projectResourceGrouping";
import type { DealResource } from "@/lbs/types";

type ResourceLightboxProps = {
  resource: DealResource | null;
  onClose: () => void;
};

export const ResourceLightbox = ({ resource, onClose }: ResourceLightboxProps) => {
  if (!resource) return null;

  const file = resource.file;
  const title = resource.label?.trim() || file.title;
  const isImage = isImageResource(file.type);

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
            {resource.created_at ? (
              <span className="text-muted-foreground">
                {formatResourceDate(resource.created_at)}
              </span>
            ) : null}
          </div>
        </DialogHeader>

        <div className="bg-muted/30 px-6 pb-2">
          {isImage ? (
            <img
              src={file.src}
              alt={title}
              className="mx-auto max-h-[70vh] w-auto max-w-full rounded-md object-contain"
            />
          ) : (
            <div className="flex min-h-48 flex-col items-center justify-center gap-3 rounded-md border bg-background p-8 text-center">
              <p className="text-sm text-muted-foreground">{file.title}</p>
              <Button type="button" variant="outline" asChild>
                <a href={file.src} target="_blank" rel="noreferrer">
                  <ExternalLink className="size-4" />
                  Open file
                </a>
              </Button>
            </div>
          )}
        </div>

        <div className="flex justify-end gap-2 px-6 pb-6">
          <Button type="button" variant="outline" asChild>
            <a href={file.src} download={file.title} target="_blank" rel="noreferrer">
              <Download className="size-4" />
              Download
            </a>
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
