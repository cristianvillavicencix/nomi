import { useState } from "react";
import { Camera, Check, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import type { FormFieldDef } from "@/modules/forms/types";
import { FormFileUploadZone } from "@/modules/forms/public/fields/FormFileUploadZone";
import {
  uploadFormFile,
  type UploadedFormFile,
} from "@/modules/forms/public/uploadFormFile";
import { PROJECT_RESOURCES_UPLOAD_LIMITS } from "@/modules/deals/projectResourcesUploadLimits";

type DynamicFileGroupsFieldProps = {
  field: FormFieldDef;
  groupKey: string;
  groupIndex?: number;
  groupTotal?: number;
  /** All service names in wizard order — used for the progress strip. */
  allGroupKeys?: string[];
  value: unknown;
  token: string;
  disabled?: boolean;
  onChange: (next: Record<string, UploadedFormFile[]>) => void;
  /** Let the client add another service mid-upload (also syncs to brief on submit). */
  onAddService?: (serviceName: string) => void;
};

const readGroups = (value: unknown): Record<string, UploadedFormFile[]> => {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return value as Record<string, UploadedFormFile[]>;
};

const countGroupFiles = (
  groups: Record<string, UploadedFormFile[]>,
  key: string,
) => (Array.isArray(groups[key]) ? groups[key].length : 0);

export const DynamicFileGroupsField = ({
  field,
  groupKey,
  groupIndex,
  groupTotal,
  allGroupKeys,
  value,
  token,
  disabled,
  onChange,
  onAddService,
}: DynamicFileGroupsFieldProps) => {
  const [uploading, setUploading] = useState(false);
  const [uploadingCount, setUploadingCount] = useState(0);
  const [addingService, setAddingService] = useState(false);
  const [newServiceName, setNewServiceName] = useState("");
  const groups = readGroups(value);
  const files = groups[groupKey] ?? [];
  const maxFiles =
    field.max_files_per_group ??
    PROJECT_RESOURCES_UPLOAD_LIMITS.servicePhotosPerService;
  const stepNumber = (groupIndex ?? 0) + 1;
  const total = groupTotal ?? allGroupKeys?.length ?? 0;
  const remainingServices = Math.max(0, total - stepNumber);
  const progressKeys =
    allGroupKeys && allGroupKeys.length > 1 ? allGroupKeys : null;

  const setGroupFiles = (nextFiles: UploadedFormFile[]) => {
    onChange({ ...groups, [groupKey]: nextFiles });
  };

  const handleFiles = async (selected: File[]) => {
    if (!selected.length || !token) return;
    const remaining = maxFiles - files.length;
    if (remaining <= 0) return;

    setUploading(true);
    setUploadingCount(Math.min(selected.length, remaining));
    try {
      const batch = selected.slice(0, remaining);
      const uploaded = await Promise.all(
        batch.map((file) =>
          uploadFormFile(file, {
            token,
            fieldKey: field.key,
            groupKey,
          }),
        ),
      );
      setGroupFiles([...files, ...uploaded]);
    } finally {
      setUploading(false);
      setUploadingCount(0);
    }
  };

  const submitNewService = () => {
    const trimmed = newServiceName.trim();
    if (!trimmed || !onAddService) return;
    onAddService(trimmed);
    setNewServiceName("");
    setAddingService(false);
  };

  return (
    <div className="space-y-5">
      <div className="space-y-3">
        {total > 1 ? (
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Service {stepNumber} of {total}
          </p>
        ) : null}
        <div className="space-y-1">
          <h2 className="text-xl font-semibold tracking-tight sm:text-2xl">
            {groupKey}
          </h2>
          <p className="text-sm text-muted-foreground">
            Upload photos for <span className="font-medium text-foreground">{groupKey}</span> only
            {remainingServices > 0
              ? ` — ${remainingServices} more service${remainingServices === 1 ? "" : "s"} after this.`
              : "."}
          </p>
        </div>

        {progressKeys ? (
          <ul className="flex flex-wrap gap-2" aria-label="Services progress">
            {progressKeys.map((key, index) => {
              const count = countGroupFiles(groups, key);
              const isCurrent = key === groupKey;
              const done = count > 0;
              return (
                <li
                  key={key}
                  className={cn(
                    "inline-flex max-w-full items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs",
                    isCurrent
                      ? "border-primary bg-primary/10 font-medium text-foreground"
                      : done
                        ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-900 dark:text-emerald-100"
                        : "border-border bg-muted/40 text-muted-foreground",
                  )}
                >
                  {done ? (
                    <Check className="size-3 shrink-0" aria-hidden />
                  ) : (
                    <Camera className="size-3 shrink-0" aria-hidden />
                  )}
                  <span className="truncate">
                    {index + 1}. {key}
                    {done ? ` (${count})` : ""}
                  </span>
                </li>
              );
            })}
          </ul>
        ) : null}
      </div>

      <FormFileUploadZone
        id={`${field.key}-${groupKey}`}
        accept={field.accept}
        multiple
        maxFiles={maxFiles}
        files={files}
        disabled={disabled}
        uploading={uploading}
        uploadingCount={uploadingCount}
        onFilesSelected={(next) => void handleFiles(next)}
        onRemove={(index) => {
          setGroupFiles(files.filter((_, fileIndex) => fileIndex !== index));
        }}
        emptyTitle={`Add ${groupKey} photos`}
        emptySubtitle="Only photos for this service — not for other services"
      />

      {onAddService ? (
        <div className="rounded-xl border border-dashed bg-muted/10 p-4">
          {addingService ? (
            <div className="space-y-3">
              <p className="text-sm font-medium text-foreground">
                Add another service
              </p>
              <p className="text-xs text-muted-foreground">
                We’ll open a new photo step for it and add it to your project
                brief.
              </p>
              <div className="flex flex-col gap-2 sm:flex-row">
                <Input
                  value={newServiceName}
                  disabled={disabled || uploading}
                  placeholder="e.g. Deck staining"
                  autoFocus
                  onChange={(event) => setNewServiceName(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      event.preventDefault();
                      submitNewService();
                    }
                  }}
                />
                <div className="flex gap-2">
                  <Button
                    type="button"
                    disabled={disabled || uploading || !newServiceName.trim()}
                    onClick={submitNewService}
                  >
                    Add
                  </Button>
                  <Button
                    type="button"
                    variant="secondary"
                    disabled={disabled || uploading}
                    onClick={() => {
                      setAddingService(false);
                      setNewServiceName("");
                    }}
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            </div>
          ) : (
            <Button
              type="button"
              variant="outline"
              className="w-full sm:w-auto"
              disabled={disabled || uploading}
              onClick={() => setAddingService(true)}
            >
              <Plus className="size-4" />
              Add another service
            </Button>
          )}
        </div>
      ) : null}
    </div>
  );
};

export const WizardSummaryStep = ({
  answers,
}: {
  answers: Record<string, unknown>;
}) => {
  const logos = Array.isArray(answers.logos) ? answers.logos.length : 0;
  const teamPhotos = Array.isArray(answers.team_photos)
    ? answers.team_photos.filter((entry) => {
        if (!entry || typeof entry !== "object") return false;
        if ("file" in entry) {
          return Boolean((entry as { file?: unknown }).file);
        }
        return Boolean((entry as { url?: unknown }).url);
      }).length
    : 0;
  const services = Array.isArray(answers.services)
    ? answers.services.filter(Boolean).map(String)
    : [];
  const servicePhotos = answers.service_photos;
  const photoGroups: Record<string, unknown[]> =
    servicePhotos &&
    typeof servicePhotos === "object" &&
    !Array.isArray(servicePhotos)
      ? (servicePhotos as Record<string, unknown[]>)
      : {};

  let photoCount = 0;
  const perServiceCounts = services.map((service) => {
    const group = photoGroups[service];
    const count = Array.isArray(group) ? group.length : 0;
    photoCount += count;
    return { service, count };
  });

  let beforeAfterCount = 0;
  const beforeAfterRaw = answers.before_after_photos;
  if (
    beforeAfterRaw &&
    typeof beforeAfterRaw === "object" &&
    !Array.isArray(beforeAfterRaw)
  ) {
    const entries =
      (
        beforeAfterRaw as {
          services?: Record<
            string,
            {
              pairs?: Array<{
                before?: unknown;
                after?: unknown;
              }>;
              before?: unknown[];
              after?: unknown[];
            }
          >;
        }
      ).services ?? {};
    beforeAfterCount = Object.values(entries).reduce((sum, entry) => {
      if (Array.isArray(entry?.pairs) && entry.pairs.length > 0) {
        return (
          sum +
          entry.pairs.reduce((pairSum, pair) => {
            return pairSum + (pair?.before ? 1 : 0) + (pair?.after ? 1 : 0);
          }, 0)
        );
      }
      const before = Array.isArray(entry?.before) ? entry.before.length : 0;
      const after = Array.isArray(entry?.after) ? entry.after.length : 0;
      return sum + before + after;
    }, 0);
  }

  return (
    <section className="space-y-4 rounded-xl border bg-muted/10 p-5">
      <h2 className="text-base font-semibold">Summary</h2>
      <ul className="space-y-2 text-sm text-muted-foreground">
        <li>
          <span className="font-medium text-foreground">Company:</span>{" "}
          {String(answers.company_name ?? "—")}
        </li>
        {answers.industry ? (
          <li>
            <span className="font-medium text-foreground">Industry:</span>{" "}
            {String(answers.industry)}
          </li>
        ) : null}
        <li>
          <span className="font-medium text-foreground">Logos:</span> {logos}
        </li>
        <li>
          <span className="font-medium text-foreground">Team photos:</span>{" "}
          {teamPhotos}
        </li>
        <li>
          <span className="font-medium text-foreground">Services:</span>{" "}
          {services.length}
        </li>
        <li>
          <span className="font-medium text-foreground">Service photos:</span>{" "}
          {photoCount}
        </li>
        {perServiceCounts.length > 0 ? (
          <li className="space-y-1 pt-1">
            <span className="font-medium text-foreground">By service:</span>
            <ul className="mt-1 space-y-1 pl-1">
              {perServiceCounts.map(({ service, count }) => (
                <li key={service} className="flex justify-between gap-3">
                  <span className="truncate">{service}</span>
                  <span
                    className={
                      count > 0
                        ? "shrink-0 text-foreground"
                        : "shrink-0 text-amber-700 dark:text-amber-300"
                    }
                  >
                    {count > 0 ? `${count} photo${count === 1 ? "" : "s"}` : "None"}
                  </span>
                </li>
              ))}
            </ul>
          </li>
        ) : null}
        <li>
          <span className="font-medium text-foreground">
            Before &amp; after photos:
          </span>{" "}
          {beforeAfterCount}
        </li>
      </ul>
    </section>
  );
};
