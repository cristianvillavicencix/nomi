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
import type { FormFieldDef } from "@/lbs/forms-v2/types";

type FormFieldRendererProps = {
  field: FormFieldDef;
  value: unknown;
  onChange: (next: unknown) => void;
};

export const FormFieldRenderer = ({
  field,
  value,
  onChange,
}: FormFieldRendererProps) => {
  const stringValue =
    value == null
      ? ""
      : Array.isArray(value)
        ? value.join(", ")
        : String(value);

  const commonLabel = (
    <Label htmlFor={field.key}>
      {field.label ?? field.key}
      {field.required ? " *" : ""}
    </Label>
  );

  if (field.type === "textarea") {
    return (
      <div className="space-y-2">
        {commonLabel}
        <Textarea
          id={field.key}
          value={stringValue}
          placeholder={field.placeholder}
          onChange={(event) => onChange(event.target.value)}
          rows={4}
        />
      </div>
    );
  }

  if (field.type === "select" || field.type === "radio") {
    return (
      <div className="space-y-2">
        {commonLabel}
        <Select value={stringValue} onValueChange={(next) => onChange(next)}>
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
      </div>
    );
  }

  if (field.type === "rating") {
    const min = field.min ?? 0;
    const max = field.max ?? 10;
    const options = Array.from({ length: max - min + 1 }, (_, index) =>
      String(min + index),
    );
    return (
      <div className="space-y-2">
        {commonLabel}
        <div className="flex flex-wrap gap-2">
          {options.map((option) => (
            <button
              key={option}
              type="button"
              className={`size-9 rounded-md border text-sm ${
                stringValue === option
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border"
              }`}
              onClick={() => onChange(option)}
            >
              {option}
            </button>
          ))}
        </div>
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
        value={stringValue}
        placeholder={field.placeholder}
        onChange={(event) => onChange(event.target.value)}
      />
      {field.help_text ? (
        <p className="text-xs text-muted-foreground">{field.help_text}</p>
      ) : null}
    </div>
  );
};
