import { ExternalLink, Paperclip, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  isImageResource,
  type ProjectResourceTabCategory,
} from "@/lbs/deals/projectResourceConstants";
import { formatResourceDate } from "@/lbs/deals/projectResourceGrouping";
import type { DealResource } from "@/lbs/types";

type ResourceMediaCardProps = {
  resource: DealResource;
  onPreview: () => void;
  onDelete: () => void;
  isDeleting: boolean;
};

export const ResourceMediaCard = ({
  resource,
  onPreview,
  onDelete,
  isDeleting,
}: ResourceMediaCardProps) => {
  const file = resource.file;
  const title = resource.label?.trim() || file.title;
  const isImage = isImageResource(file.type);

  return (
    <div className="group relative overflow-hidden rounded-lg border bg-card">
      <button
        type="button"
        onClick={onPreview}
        className="block w-full text-left"
      >
        {isImage ? (
          <div className="flex aspect-square items-center justify-center overflow-hidden bg-[linear-gradient(45deg,hsl(var(--muted)/0.55)_25%,transparent_25%,transparent_75%,hsl(var(--muted)/0.55)_75%,hsl(var(--muted)/0.55)),linear-gradient(45deg,hsl(var(--muted)/0.55)_25%,transparent_25%,transparent_75%,hsl(var(--muted)/0.55)_75%,hsl(var(--muted)/0.55))] bg-[length:16px_16px] bg-[position:0_0,8px_8px] p-2">
            <img
              src={file.src}
              alt={title}
              className="max-h-full max-w-full rounded-sm object-contain transition-transform group-hover:scale-[1.02]"
            />
          </div>
        ) : (
          <div className="flex aspect-[4/3] flex-col items-center justify-center gap-2 bg-muted/20 p-4 text-center">
            <Paperclip className="size-5 text-muted-foreground" />
            <span className="line-clamp-2 text-sm">{file.title}</span>
          </div>
        )}
      </button>

      <div className="space-y-1 p-3">
        <div className="truncate text-sm font-medium">{title}</div>
        <div className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
          <span className="capitalize">{resource.source ?? "team"}</span>
          {resource.created_at ? (
            <>
              <span>·</span>
              <span>{formatResourceDate(resource.created_at)}</span>
            </>
          ) : null}
        </div>
      </div>

      <div className="absolute right-2 top-2 flex gap-1 opacity-0 transition-opacity group-hover:opacity-100">
        <Button
          type="button"
          size="icon"
          variant="secondary"
          className="size-8"
          asChild
        >
          <a
            href={file.src}
            target="_blank"
            rel="noreferrer"
            onClick={(event) => event.stopPropagation()}
          >
            <ExternalLink className="size-3.5" />
            <span className="sr-only">Open file</span>
          </a>
        </Button>
        <Button
          type="button"
          size="icon"
          variant="secondary"
          className="size-8 text-destructive"
          onClick={onDelete}
          disabled={isDeleting}
        >
          <Trash2 className="size-3.5" />
          <span className="sr-only">Delete</span>
        </Button>
      </div>
    </div>
  );
};

const ResourceGrid = ({
  items,
  onPreview,
  onDelete,
  deletingId,
}: {
  items: DealResource[];
  onPreview: (resource: DealResource) => void;
  onDelete: (resource: DealResource) => void;
  deletingId?: string | number | null;
}) => (
  <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
    {items.map((resource) => (
      <ResourceMediaCard
        key={String(resource.id)}
        resource={resource}
        onPreview={() => onPreview(resource)}
        onDelete={() => onDelete(resource)}
        isDeleting={deletingId === resource.id}
      />
    ))}
  </div>
);

export const ResourceCategoryContent = ({
  categoryId,
  items,
  serviceGroups,
  onPreview,
  onDelete,
  deletingId,
}: {
  categoryId: ProjectResourceTabCategory;
  items: DealResource[];
  serviceGroups?: Array<[string, DealResource[]]>;
  onPreview: (resource: DealResource) => void;
  onDelete: (resource: DealResource) => void;
  deletingId?: string | number | null;
}) => {
  if (items.length === 0) {
    return (
      <div className="rounded-lg border border-dashed bg-muted/20 px-4 py-12 text-center text-sm text-muted-foreground">
        No files in this section yet.
      </div>
    );
  }

  if (
    categoryId === "service-photo" &&
    serviceGroups &&
    serviceGroups.length > 0
  ) {
    return (
      <div className="space-y-6">
        {serviceGroups.map(([serviceName, groupItems]) => (
          <div key={serviceName} className="space-y-3">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium">{serviceName}</span>
              <Badge variant="outline">{groupItems.length}</Badge>
            </div>
            <ResourceGrid
              items={groupItems}
              onPreview={onPreview}
              onDelete={onDelete}
              deletingId={deletingId}
            />
          </div>
        ))}
      </div>
    );
  }

  return (
    <ResourceGrid
      items={items}
      onPreview={onPreview}
      onDelete={onDelete}
      deletingId={deletingId}
    />
  );
};
