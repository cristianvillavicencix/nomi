import { useMemo, useState } from "react";
import { ChevronDown, Sparkles } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import type { FormFieldDef } from "@/modules/forms/types";
import { FormFileUploadZone } from "@/modules/forms/public/fields/FormFileUploadZone";
import {
  uploadFormFile,
  type UploadedFormFile,
} from "@/modules/forms/public/uploadFormFile";
import { readStringList } from "@/modules/forms/wizardStepUtils";

export type BeforeAfterServiceEntry = {
  description?: string;
  before?: UploadedFormFile[];
  after?: UploadedFormFile[];
};

export type BeforeAfterPhotosValue = {
  selected?: string[];
  services?: Record<string, BeforeAfterServiceEntry>;
};

type BeforeAfterPhotosFieldProps = {
  field: FormFieldDef;
  services: string[];
  value: unknown;
  token: string;
  disabled?: boolean;
  onChange: (next: BeforeAfterPhotosValue) => void;
};

const readValue = (value: unknown): BeforeAfterPhotosValue => {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return { selected: [], services: {} };
  }
  const record = value as BeforeAfterPhotosValue;
  return {
    selected: readStringList(record.selected),
    services:
      record.services && typeof record.services === "object"
        ? record.services
        : {},
  };
};

const readFiles = (value: unknown): UploadedFormFile[] =>
  Array.isArray(value) ? (value as UploadedFormFile[]) : [];

export const BeforeAfterPhotosField = ({
  field,
  services,
  value,
  token,
  disabled,
  onChange,
}: BeforeAfterPhotosFieldProps) => {
  const parsed = useMemo(() => readValue(value), [value]);
  const selected = parsed.selected ?? [];
  const entries = parsed.services ?? {};
  const maxFiles = field.max_files_per_group ?? 10;
  const [uploadingKey, setUploadingKey] = useState<string | null>(null);
  const [uploadingCount, setUploadingCount] = useState(0);

  const patchValue = (nextSelected: string[], nextEntries: typeof entries) => {
    onChange({ selected: nextSelected, services: nextEntries });
  };

  const toggleService = (service: string, checked: boolean) => {
    const nextSelected = checked
      ? [...selected, service]
      : selected.filter((entry) => entry !== service);
    const nextEntries = { ...entries };
    if (checked && !nextEntries[service]) {
      nextEntries[service] = { description: "", before: [], after: [] };
    }
    patchValue(nextSelected, nextEntries);
  };

  const patchService = (
    service: string,
    patch: Partial<BeforeAfterServiceEntry>,
  ) => {
    patchValue(selected, {
      ...entries,
      [service]: {
        description: entries[service]?.description ?? "",
        before: entries[service]?.before ?? [],
        after: entries[service]?.after ?? [],
        ...patch,
      },
    });
  };

  const uploadBatch = async (
    service: string,
    slot: "before" | "after",
    files: File[],
  ) => {
    if (!files.length || !token) return;
    const current = entries[service] ?? {
      description: "",
      before: [],
      after: [],
    };
    const existing = readFiles(current[slot]);
    const remaining = maxFiles - existing.length;
    if (remaining <= 0) return;

    const batch = files.slice(0, remaining);
    const uploadKey = `${service}:${slot}`;
    setUploadingKey(uploadKey);
    setUploadingCount(batch.length);
    try {
      const uploaded = await Promise.all(
        batch.map((file) =>
          uploadFormFile(file, {
            token,
            fieldKey: field.key,
            groupKey: `${service}:${slot}`,
          }),
        ),
      );
      patchService(service, {
        [slot]: [...existing, ...uploaded],
      });
    } finally {
      setUploadingKey(null);
      setUploadingCount(0);
    }
  };

  if (services.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        Add services first to upload before and after photos.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      <div className="rounded-xl border bg-muted/10 p-4">
        <div className="flex items-start gap-3">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <Sparkles className="size-5" />
          </div>
          <div className="space-y-1">
            <p className="text-sm font-medium text-foreground">
              Optional transformation photos
            </p>
            <p className="text-sm text-muted-foreground">
              Check the services where you have before and after photos. You can
              skip this step if you do not have any.
            </p>
          </div>
        </div>
      </div>

      <div className="space-y-3">
        {services.map((service) => {
          const isSelected = selected.includes(service);
          const entry = entries[service];
          const beforeFiles = readFiles(entry?.before);
          const afterFiles = readFiles(entry?.after);
          const isUploadingBefore = uploadingKey === `${service}:before`;
          const isUploadingAfter = uploadingKey === `${service}:after`;

          return (
            <div
              key={service}
              className={cn(
                "rounded-xl border transition-colors",
                isSelected ? "border-primary/30 bg-primary/5" : "bg-card",
              )}
            >
              <label className="flex cursor-pointer items-center gap-3 p-4">
                <Checkbox
                  checked={isSelected}
                  disabled={disabled}
                  onCheckedChange={(checked) =>
                    toggleService(service, checked === true)
                  }
                />
                <span className="flex-1 text-sm font-medium">{service}</span>
                <ChevronDown
                  className={cn(
                    "size-4 text-muted-foreground transition-transform",
                    isSelected ? "rotate-180" : "",
                  )}
                />
              </label>

              {isSelected ? (
                <div className="space-y-4 border-t px-4 pb-4 pt-3">
                  <div className="space-y-2">
                    <Label htmlFor={`${field.key}-${service}-description`}>
                      Short description (optional)
                    </Label>
                    <Textarea
                      id={`${field.key}-${service}-description`}
                      value={entry?.description ?? ""}
                      disabled={disabled}
                      rows={2}
                      placeholder="e.g. Full kitchen remodel, 3-week project"
                      onChange={(event) =>
                        patchService(service, {
                          description: event.target.value,
                        })
                      }
                    />
                  </div>

                  <div className="grid gap-4 lg:grid-cols-2">
                    <div className="space-y-2">
                      <Label>Before photos</Label>
                      <FormFileUploadZone
                        id={`${field.key}-${service}-before`}
                        accept={field.accept}
                        multiple
                        maxFiles={maxFiles}
                        files={beforeFiles}
                        disabled={disabled}
                        uploading={isUploadingBefore}
                        uploadingCount={uploadingCount}
                        compact
                        emptyTitle="Upload before photos"
                        emptySubtitle="Tap to add photos from your gallery"
                        onFilesSelected={(next) =>
                          void uploadBatch(service, "before", next)
                        }
                        onRemove={(index) => {
                          patchService(service, {
                            before: beforeFiles.filter(
                              (_, fileIndex) => fileIndex !== index,
                            ),
                          });
                        }}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>After photos</Label>
                      <FormFileUploadZone
                        id={`${field.key}-${service}-after`}
                        accept={field.accept}
                        multiple
                        maxFiles={maxFiles}
                        files={afterFiles}
                        disabled={disabled}
                        uploading={isUploadingAfter}
                        uploadingCount={uploadingCount}
                        compact
                        emptyTitle="Upload after photos"
                        emptySubtitle="Tap to add photos from your gallery"
                        onFilesSelected={(next) =>
                          void uploadBatch(service, "after", next)
                        }
                        onRemove={(index) => {
                          patchService(service, {
                            after: afterFiles.filter(
                              (_, fileIndex) => fileIndex !== index,
                            ),
                          });
                        }}
                      />
                    </div>
                  </div>
                </div>
              ) : null}
            </div>
          );
        })}
      </div>
    </div>
  );
};
