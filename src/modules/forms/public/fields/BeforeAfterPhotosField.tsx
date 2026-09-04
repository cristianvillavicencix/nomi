import { useMemo, useState } from "react";
import { Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { IconButton } from "@/components/ui/icon-button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import type { FormFieldDef } from "@/modules/forms/types";
import { FormFileUploadZone } from "@/modules/forms/public/fields/FormFileUploadZone";
import {
  uploadFormFile,
  type UploadedFormFile,
} from "@/modules/forms/public/uploadFormFile";
import { readStringList } from "@/modules/forms/wizardStepUtils";

export type BeforeAfterPair = {
  id: string;
  description?: string;
  before?: UploadedFormFile | null;
  after?: UploadedFormFile | null;
};

export type BeforeAfterServiceEntry = {
  pairs?: BeforeAfterPair[];
  /** @deprecated Prefer pairs — kept for older drafts. */
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

const createPairId = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `pair-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

const createEmptyPair = (): BeforeAfterPair => ({
  id: createPairId(),
  description: "",
  before: null,
  after: null,
});

const readFiles = (value: unknown): UploadedFormFile[] =>
  Array.isArray(value) ? (value as UploadedFormFile[]) : [];

/** Normalize legacy before[]/after[] dumps into one-to-one pairs. */
export const normalizeBeforeAfterPairs = (
  entry?: BeforeAfterServiceEntry | null,
): BeforeAfterPair[] => {
  if (!entry) return [createEmptyPair()];
  if (Array.isArray(entry.pairs) && entry.pairs.length > 0) {
    return entry.pairs.map((pair) => ({
      id: pair.id || createPairId(),
      description: pair.description ?? "",
      before: pair.before ?? null,
      after: pair.after ?? null,
    }));
  }

  const before = readFiles(entry.before);
  const after = readFiles(entry.after);
  const count = Math.max(before.length, after.length, 1);
  const sharedDescription = String(entry.description ?? "").trim();

  return Array.from({ length: count }, (_, index) => ({
    id: createPairId(),
    description: index === 0 ? sharedDescription : "",
    before: before[index] ?? null,
    after: after[index] ?? null,
  }));
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
  const maxPairs = field.max_files_per_group ?? 5;
  const [uploadingKey, setUploadingKey] = useState<string | null>(null);

  const patchValue = (nextSelected: string[], nextEntries: typeof entries) => {
    onChange({ selected: nextSelected, services: nextEntries });
  };

  const toggleService = (service: string, checked: boolean) => {
    const nextSelected = checked
      ? [...selected, service]
      : selected.filter((entry) => entry !== service);
    const nextEntries = { ...entries };
    if (checked && !nextEntries[service]) {
      nextEntries[service] = { pairs: [createEmptyPair()] };
    }
    if (!checked) {
      delete nextEntries[service];
    }
    patchValue(nextSelected, nextEntries);
  };

  const setServicePairs = (service: string, pairs: BeforeAfterPair[]) => {
    patchValue(selected, {
      ...entries,
      [service]: { pairs },
    });
  };

  const updatePair = (
    service: string,
    pairId: string,
    patch: Partial<BeforeAfterPair>,
  ) => {
    const pairs = normalizeBeforeAfterPairs(entries[service]).map((pair) =>
      pair.id === pairId ? { ...pair, ...patch } : pair,
    );
    setServicePairs(service, pairs);
  };

  const addPair = (service: string) => {
    const current = normalizeBeforeAfterPairs(entries[service]);
    if (current.length >= maxPairs) return;
    setServicePairs(service, [...current, createEmptyPair()]);
  };

  const removePair = (service: string, pairId: string) => {
    const pairs = normalizeBeforeAfterPairs(entries[service]);
    if (pairs.length <= 1) {
      setServicePairs(service, [createEmptyPair()]);
      return;
    }
    setServicePairs(
      service,
      pairs.filter((pair) => pair.id !== pairId),
    );
  };

  const uploadSingle = async (
    service: string,
    pairId: string,
    slot: "before" | "after",
    files: File[],
  ) => {
    const file = files[0];
    if (!file || !token) return;

    const uploadKey = `${service}:${pairId}:${slot}`;
    setUploadingKey(uploadKey);
    try {
      const uploaded = await uploadFormFile(file, {
        token,
        fieldKey: field.key,
        groupKey: `${service}:${pairId}:${slot}`,
      });
      updatePair(service, pairId, { [slot]: uploaded });
    } finally {
      setUploadingKey(null);
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
      <div className="space-y-3">
        {services.map((service) => {
          const isSelected = selected.includes(service);
          const pairs = isSelected
            ? normalizeBeforeAfterPairs(entries[service])
            : [];

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
                {isSelected ? (
                  <span className="text-xs text-muted-foreground">
                    {pairs.length} pair{pairs.length === 1 ? "" : "s"}
                  </span>
                ) : null}
              </label>

              {isSelected ? (
                <div className="space-y-4 border-t px-4 pb-4 pt-3">
                  {pairs.map((pair, pairIndex) => {
                    const beforeFiles = pair.before ? [pair.before] : [];
                    const afterFiles = pair.after ? [pair.after] : [];
                    const uploadingBefore =
                      uploadingKey === `${service}:${pair.id}:before`;
                    const uploadingAfter =
                      uploadingKey === `${service}:${pair.id}:after`;

                    return (
                      <div
                        key={pair.id}
                        className="space-y-3 rounded-xl border bg-background p-3 sm:p-4"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-sm font-medium text-foreground">
                            Pair {pairIndex + 1}
                          </p>
                          {pairs.length > 1 ? (
                            <IconButton
                              type="button"
                              variant="secondary"
                              disabled={disabled}
                              aria-label={`Remove pair ${pairIndex + 1}`}
                              onClick={() => removePair(service, pair.id)}
                            >
                              <X className="size-4" />
                            </IconButton>
                          ) : null}
                        </div>

                        <div className="grid gap-3 sm:grid-cols-2">
                          <div className="space-y-2">
                            <Label>Before</Label>
                            <FormFileUploadZone
                              id={`${field.key}-${service}-${pair.id}-before`}
                              accept={field.accept}
                              multiple={false}
                              maxFiles={1}
                              files={beforeFiles}
                              disabled={disabled}
                              uploading={uploadingBefore}
                              uploadingCount={uploadingBefore ? 1 : 0}
                              compact
                              emptyTitle="Before photo"
                              emptySubtitle="1 image"
                              onFilesSelected={(next) =>
                                void uploadSingle(
                                  service,
                                  pair.id,
                                  "before",
                                  next,
                                )
                              }
                              onRemove={() =>
                                updatePair(service, pair.id, { before: null })
                              }
                            />
                          </div>
                          <div className="space-y-2">
                            <Label>After</Label>
                            <FormFileUploadZone
                              id={`${field.key}-${service}-${pair.id}-after`}
                              accept={field.accept}
                              multiple={false}
                              maxFiles={1}
                              files={afterFiles}
                              disabled={disabled}
                              uploading={uploadingAfter}
                              uploadingCount={uploadingAfter ? 1 : 0}
                              compact
                              emptyTitle="After photo"
                              emptySubtitle="1 image"
                              onFilesSelected={(next) =>
                                void uploadSingle(
                                  service,
                                  pair.id,
                                  "after",
                                  next,
                                )
                              }
                              onRemove={() =>
                                updatePair(service, pair.id, { after: null })
                              }
                            />
                          </div>
                        </div>

                        <div className="space-y-2">
                          <Label
                            htmlFor={`${field.key}-${service}-${pair.id}-description`}
                          >
                            Description
                          </Label>
                          <Input
                            id={`${field.key}-${service}-${pair.id}-description`}
                            value={pair.description ?? ""}
                            disabled={disabled}
                            placeholder="e.g. Kitchen remodel — new cabinets and countertops"
                            onChange={(event) =>
                              updatePair(service, pair.id, {
                                description: event.target.value,
                              })
                            }
                          />
                        </div>
                      </div>
                    );
                  })}

                  <Button
                    type="button"
                    variant="outline"
                    className="w-full sm:w-auto"
                    disabled={disabled || pairs.length >= maxPairs}
                    onClick={() => addPair(service)}
                  >
                    <Plus className="size-4" />
                    {pairs.length >= maxPairs
                      ? `Maximum ${maxPairs} pairs`
                      : "Add another before & after"}
                  </Button>
                </div>
              ) : null}
            </div>
          );
        })}
      </div>
    </div>
  );
};
