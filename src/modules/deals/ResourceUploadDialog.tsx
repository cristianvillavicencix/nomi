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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import {
  PROJECT_RESOURCE_TAB_CATEGORIES,
  parseBeforeAfterCategorySlug,
  parseServiceCategorySlug,
} from "@/modules/deals/projectResourceConstants";
import {
  formatTeamResourceLabel,
  parseTeamResourceLabel,
} from "@/modules/deals/teamResourceLabel";

export type BeforeAfterPhotoType = "before" | "after";

export type ResourceUploadServiceOption = {
  value: string;
  label: string;
};

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
  uploadMode?: "default" | "service-name" | "before-after" | "team";
  serviceOptions?: ResourceUploadServiceOption[];
  selectedService?: string;
  onServiceChange?: (value: string) => void;
  photoType?: BeforeAfterPhotoType | "";
  onPhotoTypeChange?: (value: BeforeAfterPhotoType | "") => void;
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
  uploadMode = "default",
  serviceOptions = [],
  selectedService = "",
  onServiceChange,
  photoType = "",
  onPhotoTypeChange,
}: ResourceUploadDialogProps) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const categoryDef = PROJECT_RESOURCE_TAB_CATEGORIES.find(
    (entry) => entry.id === category,
  );
  const resolvedTitle =
    categoryLabel ??
    categoryDef?.label ??
    (parseServiceCategorySlug(category) ||
    parseBeforeAfterCategorySlug(category)
      ? category.replace(/^(service|before-after):/, "").replace(/-/g, " ")
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

  const isBeforeAfter = uploadMode === "before-after";
  const isTeam = uploadMode === "team" || category === "team";
  const isServiceName =
    uploadMode === "service-name" ||
    parseServiceCategorySlug(category) ||
    category === "service-photo";
  const teamParts = parseTeamResourceLabel(label);
  const canUpload =
    !isUploading &&
    files.length > 0 &&
    (!isBeforeAfter || (Boolean(selectedService) && Boolean(photoType)));

  const setTeamPart = (part: "name" | "role", value: string) => {
    onLabelChange(
      formatTeamResourceLabel({
        name: part === "name" ? value : teamParts.name,
        role: part === "role" ? value : teamParts.role,
      }),
    );
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
          {isBeforeAfter ? (
            <>
              <div className="space-y-2">
                <Label htmlFor="resource-before-after-service">Service *</Label>
                <Select
                  value={selectedService || undefined}
                  onValueChange={(value) => onServiceChange?.(value)}
                >
                  <SelectTrigger id="resource-before-after-service">
                    <SelectValue placeholder="Choose a service" />
                  </SelectTrigger>
                  <SelectContent>
                    {serviceOptions.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  Link these photos to a service already on this project.
                </p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="resource-before-after-type">Photo type *</Label>
                <Select
                  value={photoType || undefined}
                  onValueChange={(value) =>
                    onPhotoTypeChange?.(value as BeforeAfterPhotoType)
                  }
                >
                  <SelectTrigger id="resource-before-after-type">
                    <SelectValue placeholder="Before or after" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="before">Before</SelectItem>
                    <SelectItem value="after">After</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="resource-label">Caption (optional)</Label>
                <Input
                  id="resource-label"
                  value={label}
                  onChange={(event) => onLabelChange(event.target.value)}
                  placeholder="Short note about this photo"
                />
              </div>
            </>
          ) : isTeam ? (
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="resource-team-name">Name</Label>
                <Input
                  id="resource-team-name"
                  value={teamParts.name}
                  onChange={(event) => setTeamPart("name", event.target.value)}
                  placeholder="e.g. Maria Lopez"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="resource-team-role">Role</Label>
                <Input
                  id="resource-team-role"
                  value={teamParts.role}
                  onChange={(event) => setTeamPart("role", event.target.value)}
                  placeholder="e.g. Project manager"
                />
              </div>
            </div>
          ) : isServiceName ? (
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
                PNG, JPG, SVG, PDF, and WebP supported
              </p>
            </div>
            <Input
              ref={fileInputRef}
              id="resource-files"
              type="file"
              accept="image/*,.png,.jpg,.jpeg,.pdf,.svg,.webp"
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
          <Button type="button" onClick={onUpload} disabled={!canUpload}>
            {isUploading ? <Loader2 className="size-4 animate-spin" /> : null}
            Upload
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
