import type { FormFieldDef } from "@/lbs/forms-v2/types";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

type FieldPreviewProps = {
  field: FormFieldDef;
  selected?: boolean;
  onClick?: () => void;
};

export const FieldPreview = ({
  field,
  selected,
  onClick,
}: FieldPreviewProps) => {
  const label = (
    <Label className="text-sm font-medium">
      {field.label ?? field.key}
      {field.required ? <span className="text-destructive"> *</span> : null}
    </Label>
  );

  const wrapperClass = cn(
    "rounded-lg border bg-background p-3 transition-colors",
    selected ? "border-primary ring-2 ring-primary/20" : "border-border",
    onClick ? "cursor-pointer hover:border-primary/40" : "",
  );

  const renderControl = () => {
    switch (field.type) {
      case "textarea":
        return (
          <Textarea
            disabled
            placeholder={field.placeholder ?? "Long text…"}
            rows={3}
          />
        );
      case "select":
      case "radio":
        return (
          <div className="space-y-1">
            {(field.options ?? ["Option 1"]).map((option) => (
              <div
                key={option}
                className="rounded-md border px-3 py-2 text-sm text-muted-foreground"
              >
                {option}
              </div>
            ))}
          </div>
        );
      case "checkbox":
        return (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <div className="size-4 rounded border" />
            {field.label}
          </div>
        );
      case "multi_select":
        return (
          <div className="flex flex-wrap gap-2">
            {(field.options ?? ["Option"]).map((option) => (
              <span
                key={option}
                className="rounded-full border px-2 py-1 text-xs text-muted-foreground"
              >
                {option}
              </span>
            ))}
          </div>
        );
      case "rating":
        return (
          <div className="flex flex-wrap gap-1">
            {Array.from(
              { length: (field.max ?? 10) - (field.min ?? 0) + 1 },
              (_, index) => (
                <span
                  key={index}
                  className="inline-flex size-8 items-center justify-center rounded-md border text-xs"
                >
                  {(field.min ?? 0) + index}
                </span>
              ),
            )}
          </div>
        );
      case "file":
      case "file_multi":
        return (
          <div className="rounded-md border border-dashed px-3 py-6 text-center text-sm text-muted-foreground">
            {field.type === "file_multi" ? "Upload files" : "Upload file"}
          </div>
        );
      case "signature":
        return (
          <div className="h-24 rounded-md border border-dashed bg-muted/30 text-center text-sm leading-[6rem] text-muted-foreground">
            Sign here
          </div>
        );
      case "heading":
        return (
          <h3 className="text-lg font-semibold">{field.label ?? "Heading"}</h3>
        );
      case "divider":
        return <hr className="border-border" />;
      default:
        return (
          <Input
            disabled
            type={
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
                        : "text"
            }
            placeholder={field.placeholder ?? field.label}
          />
        );
    }
  };

  if (field.type === "heading" || field.type === "divider") {
    return (
      <div className={wrapperClass} onClick={onClick} role="presentation">
        {renderControl()}
      </div>
    );
  }

  return (
    <div
      className={cn("space-y-2", wrapperClass)}
      onClick={onClick}
      role="presentation"
    >
      {label}
      {renderControl()}
      {field.help_text ? (
        <p className="text-xs text-muted-foreground">{field.help_text}</p>
      ) : null}
    </div>
  );
};
