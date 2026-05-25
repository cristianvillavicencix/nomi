import { useRef } from "react";
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
import { Button } from "@/components/ui/button";
import type { FormFieldDef } from "@/lbs/forms-v2/types";
import {
  uploadFormFile,
  type UploadedFormFile,
} from "@/lbs/forms-v2/public/uploadFormFile";

type FormFieldRendererProps = {
  field: FormFieldDef;
  value: unknown;
  onChange: (next: unknown) => void;
  formId?: number;
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
  disabled,
}: FormFieldRendererProps) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const isDrawing = useRef(false);

  const commonLabel = (
    <Label htmlFor={field.key}>
      {field.label ?? field.key}
      {field.required ? " *" : ""}
    </Label>
  );

  const helpText = field.help_text ? (
    <p className="text-xs text-muted-foreground">{field.help_text}</p>
  ) : null;

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

  if (field.type === "file" || field.type === "file_multi") {
    const files = Array.isArray(value)
      ? (value as UploadedFormFile[])
      : value && typeof value === "object"
        ? [value as UploadedFormFile]
        : [];

    const handleFiles = async (fileList: FileList | null) => {
      if (!fileList?.length || !formId) return;
      const uploaded = await Promise.all(
        Array.from(fileList).map((file) => uploadFormFile(file, formId)),
      );
      if (field.type === "file_multi") {
        onChange([...files, ...uploaded]);
      } else {
        onChange(uploaded[0] ?? null);
      }
    };

    return (
      <div className="space-y-2">
        {commonLabel}
        <Input
          id={field.key}
          type="file"
          disabled={disabled || !formId}
          multiple={field.type === "file_multi"}
          accept={field.accept}
          onChange={(event) => void handleFiles(event.target.files)}
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
    const startDraw = (
      event:
        | React.MouseEvent<HTMLCanvasElement>
        | React.TouchEvent<HTMLCanvasElement>,
    ) => {
      isDrawing.current = true;
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      const rect = canvas.getBoundingClientRect();
      const point =
        "touches" in event
          ? event.touches[0]
          : (event as React.MouseEvent<HTMLCanvasElement>);
      ctx.lineWidth = 2;
      ctx.lineCap = "round";
      ctx.strokeStyle = "#111";
      ctx.beginPath();
      ctx.moveTo(point.clientX - rect.left, point.clientY - rect.top);
    };

    const draw = (
      event:
        | React.MouseEvent<HTMLCanvasElement>
        | React.TouchEvent<HTMLCanvasElement>,
    ) => {
      if (!isDrawing.current) return;
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      const rect = canvas.getBoundingClientRect();
      const point =
        "touches" in event
          ? event.touches[0]
          : (event as React.MouseEvent<HTMLCanvasElement>);
      ctx.lineTo(point.clientX - rect.left, point.clientY - rect.top);
      ctx.stroke();
    };

    const endDraw = () => {
      isDrawing.current = false;
      const canvas = canvasRef.current;
      if (!canvas) return;
      onChange(canvas.toDataURL("image/png"));
    };

    return (
      <div className="space-y-2">
        {commonLabel}
        <canvas
          ref={canvasRef}
          width={480}
          height={120}
          className="w-full rounded-md border bg-white touch-none"
          onMouseDown={startDraw}
          onMouseMove={draw}
          onMouseUp={endDraw}
          onMouseLeave={endDraw}
          onTouchStart={startDraw}
          onTouchMove={draw}
          onTouchEnd={endDraw}
        />
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={disabled}
          onClick={() => {
            const canvas = canvasRef.current;
            const ctx = canvas?.getContext("2d");
            if (canvas && ctx) {
              ctx.clearRect(0, 0, canvas.width, canvas.height);
            }
            onChange("");
          }}
        >
          Clear signature
        </Button>
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
