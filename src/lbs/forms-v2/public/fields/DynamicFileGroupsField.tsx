import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import type { FormFieldDef } from "@/lbs/forms-v2/types";
import {
  uploadFormFile,
  type UploadedFormFile,
} from "@/lbs/forms-v2/public/uploadFormFile";

type DynamicFileGroupsFieldProps = {
  field: FormFieldDef;
  groupKey: string;
  value: unknown;
  token: string;
  disabled?: boolean;
  skipButtonLabel?: string;
  onChange: (next: Record<string, UploadedFormFile[]>) => void;
  onSkip?: () => void;
};

const readGroups = (value: unknown): Record<string, UploadedFormFile[]> => {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return value as Record<string, UploadedFormFile[]>;
};

export const DynamicFileGroupsField = ({
  field,
  groupKey,
  value,
  token,
  disabled,
  skipButtonLabel,
  onChange,
  onSkip,
}: DynamicFileGroupsFieldProps) => {
  const [uploading, setUploading] = useState(false);
  const groups = readGroups(value);
  const files = groups[groupKey] ?? [];
  const maxFiles = field.max_files_per_group ?? 20;

  const setGroupFiles = (nextFiles: UploadedFormFile[]) => {
    onChange({ ...groups, [groupKey]: nextFiles });
  };

  const handleFiles = async (fileList: FileList | null) => {
    if (!fileList?.length || !token) return;
    const remaining = maxFiles - files.length;
    if (remaining <= 0) return;
    setUploading(true);
    try {
      const selected = Array.from(fileList).slice(0, remaining);
      const uploaded = await Promise.all(
        selected.map((file) =>
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
    }
  };

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor={`${field.key}-${groupKey}`}>
          Fotos de &ldquo;{groupKey}&rdquo;
        </Label>
        <Input
          id={`${field.key}-${groupKey}`}
          type="file"
          multiple
          disabled={disabled || uploading || files.length >= maxFiles}
          accept={field.accept}
          onChange={(event) => void handleFiles(event.target.files)}
        />
        {files.length > 0 ? (
          <ul className="space-y-1 text-sm text-muted-foreground">
            {files.map((file) => (
              <li key={file.path ?? file.url}>{file.name}</li>
            ))}
          </ul>
        ) : (
          <p className="text-xs text-muted-foreground">
            Podés subir hasta {maxFiles} archivos para este servicio.
          </p>
        )}
      </div>
      {onSkip ? (
        <Button type="button" variant="ghost" disabled={disabled} onClick={onSkip}>
          {skipButtonLabel ?? field.skip_button_label ?? "Skip this service"}
        </Button>
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
  const services = Array.isArray(answers.services) ? answers.services.filter(Boolean).length : 0;
  const servicePhotos = answers.service_photos;
  let photoCount = 0;
  if (servicePhotos && typeof servicePhotos === "object" && !Array.isArray(servicePhotos)) {
    photoCount = Object.values(servicePhotos as Record<string, unknown[]>).reduce(
      (sum, group) => sum + (Array.isArray(group) ? group.length : 0),
      0,
    );
  }

  return (
    <section className="space-y-4 rounded-lg border p-4">
      <h2 className="text-base font-semibold">Resumen</h2>
      <ul className="space-y-2 text-sm text-muted-foreground">
        <li>
          <span className="font-medium text-foreground">Empresa:</span>{" "}
          {String(answers.company_name ?? "—")}
        </li>
        {answers.industry ? (
          <li>
            <span className="font-medium text-foreground">Industria:</span>{" "}
            {String(answers.industry)}
          </li>
        ) : null}
        <li>
          <span className="font-medium text-foreground">Logos:</span> {logos}
        </li>
        <li>
          <span className="font-medium text-foreground">Servicios:</span> {services}
        </li>
        <li>
          <span className="font-medium text-foreground">Fotos de servicios:</span>{" "}
          {photoCount}
        </li>
      </ul>
    </section>
  );
};
