import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { SignaturePad } from "@/components/ui/signature-pad";
import type { FormFieldDef } from "@/modules/forms/types";
import { DynamicListField } from "@/modules/forms/public/fields/DynamicListField";
import { FormFileMultiField } from "@/modules/forms/public/fields/FormFileMultiField";
import {
  uploadFormFile,
  type UploadedFormFile,
} from "@/modules/forms/public/uploadFormFile";

type FormFieldRendererProps = {
  field: FormFieldDef;
  value: unknown;
  onChange: (next: unknown) => void;
  formId?: number;
  token?: string;
  disabled?: boolean;
};

const readString = (value: unknown): string => {
  if (value == null) return "";
  if (Array.isArray(value)) return value.join(", ");
  return String(value);
};

export const FormFieldRenderer = ({
  field,
  value,
  onChange,
  formId,
  token,
  disabled,
}: FormFieldRendererProps) => {
  const commonLabel = (
    <Label htmlFor={field.key}>
      {field.label ?? field.key}
      {field.required ? " *" : ""}
    </Label>
  );

  const helpText = field.help_text ? (
    <p className="text-xs text-muted-foreground">{field.help_text}</p>
  ) : null;

  if (field.type === "hidden") {
    return null;
  }

  if (field.type === "formula") {
    return (
      <div className="space-y-2 rounded-md border bg-muted/20 p-3">
        {commonLabel}
        <p className="text-lg font-semibold">{readString(value) || "—"}</p>
        <p className="text-xs text-muted-foreground">(calculated)</p>
        {helpText}
      </div>
    );
  }

  if (field.type === "textarea") {
    return (
      <div className="space-y-2">
        {commonLabel}
        <Textarea
          id={field.key}
          value={readString(value)}
          placeholder={field.placeholder}
          disabled={disabled}
          onChange={(event) => onChange(event.target.value)}
          rows={4}
        />
        {helpText}
      </div>
    );
  }

  if (field.type === "select") {
    return (
      <div className="space-y-2">
        {commonLabel}
        <Select
          value={readString(value)}
          disabled={disabled}
          onValueChange={(next) => onChange(next)}
        >
          <SelectTrigger id={field.key}>
            <SelectValue placeholder={field.placeholder ?? "Select…"} />
          </SelectTrigger>
          <SelectContent>
            {(field.options ?? []).map((option) => (
              <SelectItem key={option} value={option}>
                {option.replace(/_/g, " ")}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {helpText}
      </div>
    );
  }

  if (field.type === "radio") {
    const selected = readString(value);
    return (
      <div className="space-y-2">
        {commonLabel}
        <div className="space-y-2">
          {(field.options ?? []).map((option) => (
            <label
              key={option}
              className="flex cursor-pointer items-center gap-2 text-sm"
            >
              <input
                type="radio"
                name={field.key}
                value={option}
                checked={selected === option}
                disabled={disabled}
                onChange={() => onChange(option)}
              />
              {option.replace(/_/g, " ")}
            </label>
          ))}
        </div>
        {helpText}
      </div>
    );
  }

  if (field.type === "checkbox") {
    const checked = value === true || value === "true" || value === "on";
    return (
      <div className="space-y-2">
        <label className="flex items-center gap-2 text-sm">
          <Checkbox
            id={field.key}
            checked={checked}
            disabled={disabled}
            onCheckedChange={(next) => onChange(Boolean(next))}
          />
          <span>
            {field.label ?? field.key}
            {field.required ? " *" : ""}
          </span>
        </label>
        {helpText}
      </div>
    );
  }

  if (field.type === "multi_select") {
    const selected = Array.isArray(value)
      ? value.map(String)
      : readString(value)
          .split(",")
          .map((item) => item.trim())
          .filter(Boolean);

    return (
      <div className="space-y-2">
        {commonLabel}
        <div className="flex flex-wrap gap-2">
          {(field.options ?? []).map((option) => {
            const isSelected = selected.includes(option);
            return (
              <button
                key={option}
                type="button"
                disabled={disabled}
                className={`rounded-full border px-3 py-1 text-sm ${
                  isSelected
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border"
                }`}
                onClick={() => {
                  const next = isSelected
                    ? selected.filter((item) => item !== option)
                    : [...selected, option];
                  onChange(next);
                }}
              >
                {option.replace(/_/g, " ")}
              </button>
            );
          })}
        </div>
        {helpText}
      </div>
    );
  }

  if (field.type === "rating") {
    const min = field.min ?? 0;
    const max = field.max ?? 10;
    const options = Array.from({ length: max - min + 1 }, (_, index) =>
      String(min + index),
    );
    const selected = readString(value);
    return (
      <div className="space-y-2">
        {commonLabel}
        <div className="flex flex-wrap gap-2">
          {options.map((option) => (
            <button
              key={option}
              type="button"
              disabled={disabled}
              className={`size-9 rounded-md border text-sm ${
                selected === option
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border"
              }`}
              onClick={() => onChange(option)}
            >
              {option}
            </button>
          ))}
        </div>
        {helpText}
      </div>
    );
  }

  if (field.type === "dynamic_list") {
    return (
      <div className="space-y-2">
        {commonLabel}
        <DynamicListField
          field={field}
          value={value}
          disabled={disabled}
          onChange={onChange}
        />
        {helpText}
      </div>
    );
  }

  if (field.type === "dynamic_file_groups") {
    return null;
  }

  if (field.type === "before_after_photos") {
    return null;
  }

  if (field.type === "file_multi") {
    return (
      <FormFileMultiField
        field={field}
        value={value}
        onChange={onChange}
        formId={formId}
        token={token}
        disabled={disabled}
        label={commonLabel}
        helpText={helpText}
      />
    );
  }

  if (field.type === "file") {
    const files = value && typeof value === "object" ? [value as UploadedFormFile] : [];

    const handleSingleFile = async (fileList: FileList | null) => {
      if (!fileList?.length) return;
      const uploadOptions = token
        ? { token, fieldKey: field.key }
        : formId
          ? formId
          : null;
      if (uploadOptions == null) return;

      const uploaded = await uploadFormFile(
        fileList[0],
        typeof uploadOptions === "number" ? uploadOptions : uploadOptions,
      );
      onChange(uploaded);
    };

    return (
      <div className="space-y-2">
        {commonLabel}
        <Input
          id={field.key}
          type="file"
          disabled={disabled || (!formId && !token)}
          accept={field.accept}
          onChange={(event) => void handleSingleFile(event.target.files)}
        />
        {files.length > 0 ? (
          <ul className="space-y-1 text-sm text-muted-foreground">
            {files.map((file) => (
              <li key={file.url}>
                <a href={file.url} target="_blank" rel="noreferrer">
                  {file.name}
                </a>
              </li>
            ))}
          </ul>
        ) : null}
        {helpText}
      </div>
    );
  }

  if (field.type === "signature") {
    return (
      <div className="space-y-2">
        {commonLabel}
        <SignaturePad
          value={readString(value)}
          onChange={onChange}
          disabled={disabled}
        />
        {helpText}
      </div>
    );
  }

  const inputType =
    field.type === "email"
      ? "email"
      : field.type === "phone"
        ? "tel"
        : field.type === "number"
          ? "number"
          : field.type === "url"
            ? "url"
            : field.type === "date"
              ? "date"
              : "text";

  return (
    <div className="space-y-2">
      {commonLabel}
      <Input
        id={field.key}
        type={inputType}
        value={readString(value)}
        placeholder={field.placeholder}
        disabled={disabled}
        min={field.min}
        max={field.max}
        onChange={(event) => onChange(event.target.value)}
      />
      {helpText}
    </div>
  );
};
