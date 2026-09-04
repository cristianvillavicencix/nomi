import { ExternalLink, Paperclip, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";

import { IconButton } from "@/components/ui/icon-button";
import { useStorageSignedUrl } from "@/hooks/useStorageSignedUrl";
import {
  isImageResource,
  type ProjectResourceTabCategory,
} from "@/modules/deals/projectResourceConstants";
import { groupBeforeAfterResourcesIntoPairs } from "@/modules/deals/beforeAfterResourcePairs";
import { formatResourceDate } from "@/modules/deals/projectResourceGrouping";
import { parseTeamResourceLabel } from "@/modules/deals/teamResourceLabel";
import type { DealResource } from "@/modules/types";

type ResourceMediaCardProps = {
  resource: DealResource;
  onPreview: () => void;
  onDelete: () => void;
  isDeleting: boolean;
  /** Fill the pair slot instead of a square thumbnail grid cell. */
  fillSlot?: boolean;
  badge?: string;
  /** When true, show Name / Role from "Name — Role" labels. */
  teamMember?: boolean;
};

const useResourcePreviewUrl = (resource: DealResource) => {
  const file = resource.file;
  const bucket = file.bucket ?? "project-files";
  return useStorageSignedUrl(file.src, {
    path: file.path,
    bucket,
    defaultBucket: bucket,
  });
};

export const ResourceMediaCard = ({
  resource,
  onPreview,
  onDelete,
  isDeleting,
  fillSlot = false,
  badge,
  teamMember = false,
}: ResourceMediaCardProps) => {
  const file = resource.file;
  const title = resource.label?.trim() || file.title;
  const team = teamMember ? parseTeamResourceLabel(resource.label) : null;
  const displayName = team?.name || title;
  const displayRole = team?.role || "";
  const isImage = isImageResource(file.type);
  const previewUrl = useResourcePreviewUrl(resource);

  return (
    <div className="group relative overflow-hidden rounded-lg border bg-card">
      <button
        type="button"
        onClick={onPreview}
        className="block w-full text-left"
      >
        {isImage ? (
          <div
            className={
              fillSlot
                ? "relative flex min-h-40 items-center justify-center overflow-hidden bg-muted/30 sm:min-h-48"
                : "flex aspect-square items-center justify-center overflow-hidden bg-[linear-gradient(45deg,hsl(var(--muted)/0.55)_25%,transparent_25%,transparent_75%,hsl(var(--muted)/0.55)_75%,hsl(var(--muted)/0.55)),linear-gradient(45deg,hsl(var(--muted)/0.55)_25%,transparent_25%,transparent_75%,hsl(var(--muted)/0.55)_75%,hsl(var(--muted)/0.55))] bg-[length:16px_16px] bg-[position:0_0,8px_8px] p-2"
            }
          >
            <img
              src={previewUrl}
              alt={displayName}
              className={
                fillSlot
                  ? "absolute inset-0 size-full object-cover transition-transform group-hover:scale-[1.02]"
                  : "max-h-full max-w-full rounded-sm object-contain transition-transform group-hover:scale-[1.02]"
              }
            />
          </div>
        ) : (
          <div
            className={
              fillSlot
                ? "flex min-h-40 flex-col items-center justify-center gap-2 bg-muted/20 p-4 text-center sm:min-h-48"
                : "flex aspect-[4/3] flex-col items-center justify-center gap-2 bg-muted/20 p-4 text-center"
            }
          >
            <Paperclip className="size-5 text-muted-foreground" />
            <span className="line-clamp-2 text-sm">{file.title}</span>
          </div>
        )}
      </button>

      <div className="space-y-1 p-3">
        <div className="flex flex-wrap items-center gap-1.5">
          {badge ? <Badge variant="secondary">{badge}</Badge> : null}
          {!badge &&
          resource.label?.trim().toLowerCase().startsWith("before") ? (
            <Badge variant="secondary">Before</Badge>
          ) : null}
          {!badge &&
          resource.label?.trim().toLowerCase().startsWith("after") ? (
            <Badge variant="secondary">After</Badge>
          ) : null}
          <div className="truncate text-sm font-medium">{displayName}</div>
        </div>
        {displayRole ? (
          <p className="truncate text-sm text-muted-foreground">{displayRole}</p>
        ) : null}
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
        <IconButton aria-label="Open link" variant="secondary" asChild>
          <a
            href={previewUrl}
            target="_blank"
            rel="noreferrer"
            onClick={(event) => event.stopPropagation()}
          >
            <ExternalLink className="size-3.5" />
            <span className="sr-only">Open file</span>
          </a>
        </IconButton>
        <IconButton
          variant="secondary"
          className="text-destructive"
          onClick={onDelete}
          disabled={isDeleting}
          aria-label="Delete"
        >
          <Trash2 className="size-3.5" />
          <span className="sr-only">Delete</span>
        </IconButton>
      </div>
    </div>
  );
};

const EmptyPairSlot = ({ label }: { label: string }) => (
  <div className="flex min-h-40 flex-col items-center justify-center rounded-lg border border-dashed bg-muted/10 px-3 text-center text-sm text-muted-foreground sm:min-h-48">
    <Badge variant="outline" className="mb-2">
      {label}
    </Badge>
    <span>No {label.toLowerCase()} photo yet</span>
  </div>
);

const BeforeAfterPairsGrid = ({
  items,
  onPreview,
  onDelete,
  deletingId,
}: {
  items: DealResource[];
  onPreview: (resource: DealResource) => void;
  onDelete: (resource: DealResource) => void;
  deletingId?: string | number | null;
}) => {
  const pairs = groupBeforeAfterResourcesIntoPairs(items);

  return (
    <div className="space-y-4">
      {pairs.map((pair, index) => (
        <div
          key={pair.id}
          className="space-y-3 rounded-xl border bg-card/40 p-3 sm:p-4"
        >
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm font-medium text-foreground">
              Pair {index + 1}
            </p>
            {pair.description ? (
              <p className="text-sm text-muted-foreground">{pair.description}</p>
            ) : null}
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-2">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Before
              </p>
              {pair.before ? (
                <ResourceMediaCard
                  resource={pair.before}
                  fillSlot
                  badge="Before"
                  onPreview={() => onPreview(pair.before!)}
                  onDelete={() => onDelete(pair.before!)}
                  isDeleting={deletingId === pair.before.id}
                />
              ) : (
                <EmptyPairSlot label="Before" />
              )}
            </div>
            <div className="space-y-2">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                After
              </p>
              {pair.after ? (
                <ResourceMediaCard
                  resource={pair.after}
                  fillSlot
                  badge="After"
                  onPreview={() => onPreview(pair.after!)}
                  onDelete={() => onDelete(pair.after!)}
                  isDeleting={deletingId === pair.after.id}
                />
              ) : (
                <EmptyPairSlot label="After" />
              )}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
};

const ResourceGrid = ({
  items,
  onPreview,
  onDelete,
  deletingId,
  teamMember = false,
}: {
  items: DealResource[];
  onPreview: (resource: DealResource) => void;
  onDelete: (resource: DealResource) => void;
  deletingId?: string | number | null;
  teamMember?: boolean;
}) => (
  <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
    {items.map((resource) => (
      <ResourceMediaCard
        key={String(resource.id)}
        resource={resource}
        teamMember={teamMember}
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

  if (categoryId === "before-after") {
    return (
      <BeforeAfterPairsGrid
        items={items}
        onPreview={onPreview}
        onDelete={onDelete}
        deletingId={deletingId}
      />
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
      teamMember={categoryId === "team"}
      onPreview={onPreview}
      onDelete={onDelete}
      deletingId={deletingId}
    />
  );
};
