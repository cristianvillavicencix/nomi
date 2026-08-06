import { useState, type ReactNode } from "react";
import type { FormFieldDef } from "@/modules/forms/types";
import { FormFileUploadZone } from "@/modules/forms/public/fields/FormFileUploadZone";
import {
  uploadFormFile,
  type UploadedFormFile,
} from "@/modules/forms/public/uploadFormFile";

type FormFileMultiFieldProps = {
  field: FormFieldDef;
  value: unknown;
  onChange: (next: unknown) => void;
  formId?: number;
  token?: string;
  disabled?: boolean;
  label?: ReactNode;
  helpText?: ReactNode;
};

export const FormFileMultiField = ({
  field,
  value,
  onChange,
  formId,
  token,
  disabled,
  label,
  helpText,
}: FormFileMultiFieldProps) => {
  const [uploading, setUploading] = useState(false);
  const [uploadingCount, setUploadingCount] = useState(0);
  const files = Array.isArray(value) ? (value as UploadedFormFile[]) : [];

  const handleFiles = async (selected: File[]) => {
    if (!selected.length) return;
    const uploadOptions = token
      ? { token, fieldKey: field.key }
      : formId
        ? formId
        : null;
    if (uploadOptions == null) return;

    let batch = selected;
    if (field.max_files) {
      const remaining = field.max_files - files.length;
      if (remaining <= 0) return;
      batch = batch.slice(0, remaining);
    }

    if (
      field.soft_warn_after &&
      files.length + batch.length > field.soft_warn_after
    ) {
      const proceed = window.confirm(
        field.soft_warn_message ??
          `You already added ${files.length} file(s). Continue adding more?`,
      );
      if (!proceed) return;
    }

    setUploading(true);
    setUploadingCount(batch.length);
    try {
      const uploaded = await Promise.all(
        batch.map((file) =>
          typeof uploadOptions === "number"
            ? uploadFormFile(file, uploadOptions)
            : uploadFormFile(file, uploadOptions),
        ),
      );
      onChange([...files, ...uploaded]);
    } finally {
      setUploading(false);
      setUploadingCount(0);
    }
  };

  return (
    <div className="space-y-2">
      {label}
      <FormFileUploadZone
        id={field.key}
        accept={field.accept}
        multiple
        maxFiles={field.max_files ?? 20}
        files={files}
        disabled={disabled || (!formId && !token)}
        uploading={uploading}
        uploadingCount={uploadingCount}
        onFilesSelected={(next) => void handleFiles(next)}
        onRemove={(index) => {
          onChange(files.filter((_, fileIndex) => fileIndex !== index));
        }}
        emptyTitle="Upload files"
        emptySubtitle="Drag and drop here, or tap to browse"
        compact
      />
      {helpText}
    </div>
  );
};
