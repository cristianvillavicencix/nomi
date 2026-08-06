import { useState } from "react";
import { Camera } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { FormFieldDef } from "@/modules/forms/types";
import { FormFileUploadZone } from "@/modules/forms/public/fields/FormFileUploadZone";
import {
  uploadFormFile,
  type UploadedFormFile,
} from "@/modules/forms/public/uploadFormFile";

type DynamicFileGroupsFieldProps = {
  field: FormFieldDef;
  groupKey: string;
  groupIndex?: number;
  groupTotal?: number;
  value: unknown;
  token: string;
  disabled?: boolean;
  onChange: (next: Record<string, UploadedFormFile[]>) => void;
};

const readGroups = (value: unknown): Record<string, UploadedFormFile[]> => {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return value as Record<string, UploadedFormFile[]>;
};

export const DynamicFileGroupsField = ({
  field,
  groupKey,
  groupIndex,
  groupTotal,
  value,
  token,
  disabled,
  onChange,
}: DynamicFileGroupsFieldProps) => {
  const [uploading, setUploading] = useState(false);
  const [uploadingCount, setUploadingCount] = useState(0);
  const groups = readGroups(value);
  const files = groups[groupKey] ?? [];
  const maxFiles = field.max_files_per_group ?? 20;

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

  const stepLabel =
    groupIndex != null && groupTotal != null && groupTotal > 0
      ? `Service ${groupIndex + 1} of ${groupTotal}`
      : null;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-2">
          {stepLabel ? (
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              {stepLabel}
            </p>
          ) : null}
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="secondary" className="gap-1.5 px-3 py-1 text-sm">
              <Camera className="size-3.5" />
              {groupKey}
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground">
            Add photos that showcase this service. You can upload from your
            phone or computer.
          </p>
        </div>
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
        emptyTitle="Upload service photos"
        emptySubtitle="Drag and drop here, or tap to choose from your gallery"
      />
    </div>
  );
};

export const WizardSummaryStep = ({
  answers,
}: {
  answers: Record<string, unknown>;
}) => {
  const logos = Array.isArray(answers.logos) ? answers.logos.length : 0;
  const services = Array.isArray(answers.services)
    ? answers.services.filter(Boolean).length
    : 0;
  const servicePhotos = answers.service_photos;
  let photoCount = 0;
  if (
    servicePhotos &&
    typeof servicePhotos === "object" &&
    !Array.isArray(servicePhotos)
  ) {
    photoCount = Object.values(
      servicePhotos as Record<string, unknown[]>,
    ).reduce(
      (sum, group) => sum + (Array.isArray(group) ? group.length : 0),
      0,
    );
  }

  let beforeAfterCount = 0;
  const beforeAfterRaw = answers.before_after_photos;
  if (
    beforeAfterRaw &&
    typeof beforeAfterRaw === "object" &&
    !Array.isArray(beforeAfterRaw)
  ) {
    const entries =
      (beforeAfterRaw as { services?: Record<string, { before?: unknown[]; after?: unknown[] }> })
        .services ?? {};
    beforeAfterCount = Object.values(entries).reduce((sum, entry) => {
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
          <span className="font-medium text-foreground">Services:</span>{" "}
          {services}
        </li>
        <li>
          <span className="font-medium text-foreground">Service photos:</span>{" "}
          {photoCount}
        </li>
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
