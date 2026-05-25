import { Loader2, UploadCloud } from "lucide-react";
import { useRef, useState, type DragEvent } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import {
  PROJECT_RESOURCE_TAB_CATEGORIES,
  parseServiceCategorySlug,
} from "@/lbs/deals/projectResourceConstants";

type ResourceUploadDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  category: string;
  categoryLabel?: string;
  label: string;
  onLabelChange: (label: string) => void;
  files: File[];
  onFilesChange: (files: File[]) => void;
  onUpload: () => void;
  isUploading: boolean;
};

const mergeFiles = (current: File[], incoming: File[]) => {
  const seen = new Set(
    current.map((file) => `${file.name}:${file.size}:${file.lastModified}`),
  );
  const next = [...current];
  for (const file of incoming) {
    const key = `${file.name}:${file.size}:${file.lastModified}`;
    if (seen.has(key)) continue;
    seen.add(key);
    next.push(file);
  }
  return next;
};

export const ResourceUploadDialog = ({
  open,
  onOpenChange,
  category,
  categoryLabel,
  label,
  onLabelChange,
  files,
  onFilesChange,
  onUpload,
  isUploading,
}: ResourceUploadDialogProps) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const categoryDef = PROJECT_RESOURCE_TAB_CATEGORIES.find(
    (entry) => entry.id === category,
  );
  const resolvedTitle =
    categoryLabel ??
    categoryDef?.label ??
    (parseServiceCategorySlug(category)
      ? category.replace(/^service:/, "").replace(/-/g, " ")
      : "Resources");

  const handleFiles = (incoming: File[]) => {
    if (incoming.length === 0) return;
    onFilesChange(mergeFiles(files, incoming));
  };

  const handleDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setIsDragging(false);
    handleFiles(Array.from(event.dataTransfer.files ?? []));
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Upload to {resolvedTitle}</DialogTitle>
          {categoryDef?.description ? (
            <p className="text-sm text-muted-foreground">
              {categoryDef.description}
            </p>
          ) : null}
        </DialogHeader>
        <div className="space-y-4 py-1">
          {parseServiceCategorySlug(category) || category === "service-photo" ? (
            <div className="space-y-2">
              <Label htmlFor="resource-service-label">Service name *</Label>
              <Input
                id="resource-service-label"
                value={label}
                onChange={(event) => onLabelChange(event.target.value)}
                placeholder="e.g. Kitchen remodeling"
              />
            </div>
          ) : (
            <div className="space-y-2">
              <Label htmlFor="resource-label">Label (optional)</Label>
              <Input
                id="resource-label"
                value={label}
                onChange={(event) => onLabelChange(event.target.value)}
                placeholder="Short description"
              />
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="resource-files">Photos & files</Label>
            <div
              role="button"
              tabIndex={0}
              className={cn(
                "flex min-h-28 cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border border-dashed px-4 py-6 text-center transition-colors",
                isDragging
                  ? "border-primary bg-primary/5"
                  : "border-muted-foreground/30 hover:border-muted-foreground/50",
              )}
              onClick={() => fileInputRef.current?.click()}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  fileInputRef.current?.click();
                }
              }}
              onDragEnter={(event) => {
                event.preventDefault();
                setIsDragging(true);
              }}
              onDragOver={(event) => {
                event.preventDefault();
                setIsDragging(true);
              }}
              onDragLeave={(event) => {
                event.preventDefault();
                if (event.currentTarget.contains(event.relatedTarget as Node))
                  return;
                setIsDragging(false);
              }}
              onDrop={handleDrop}
            >
              <UploadCloud className="size-8 text-muted-foreground" />
              <div className="text-sm">
                <span className="font-medium">Drop files here</span>
                <span className="text-muted-foreground">
                  {" "}
                  or click to browse
                </span>
              </div>
              <p className="text-xs text-muted-foreground">
                Images, PDF, SVG, and WebP supported
              </p>
            </div>
            <Input
              ref={fileInputRef}
              id="resource-files"
              type="file"
              accept="image/*,.pdf,.svg,.webp"
              multiple
              className="sr-only"
              onChange={(event) =>
                handleFiles(Array.from(event.target.files ?? []))
              }
            />
            {files.length > 0 ? (
              <p className="text-xs text-muted-foreground">
                {files.length} file{files.length === 1 ? "" : "s"} selected
              </p>
            ) : null}
          </div>
        </div>
        <DialogFooter>
          <Button
            type="button"
            variant="ghost"
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </Button>
          <Button
            type="button"
            onClick={onUpload}
            disabled={isUploading || files.length === 0}
          >
            {isUploading ? <Loader2 className="size-4 animate-spin" /> : null}
            Upload
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
