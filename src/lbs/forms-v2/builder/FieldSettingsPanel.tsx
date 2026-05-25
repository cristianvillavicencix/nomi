import { Copy, Trash2 } from "lucide-react";
import { useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { ConditionalLogicEditor } from "@/lbs/forms-v2/builder/ConditionalLogicEditor";
import { useFormBuilder } from "@/lbs/forms-v2/builder/FormBuilderContext";

export const FieldSettingsPanel = () => {
  const {
    schema,
    selectedFieldKey,
    updateField,
    duplicateFieldByKey,
    removeField,
  } = useFormBuilder();

  const field =
    selectedFieldKey == null
      ? null
      : ((schema.sections ?? [])
          .flatMap((section) => section.fields ?? [])
          .find((item) => item.key === selectedFieldKey) ?? null);

  if (!field) {
    return (
      <div className="rounded-lg border border-dashed p-6 text-sm text-muted-foreground">
        Select a field to edit its settings.
      </div>
    );
  }

  const hasOptions = ["select", "radio", "checkbox", "multi_select"].includes(
    String(field.type),
  );

  const priorFields = useMemo(() => {
    const result: { key: string; label: string }[] = [];
    for (const section of schema.sections ?? []) {
      for (const item of section.fields ?? []) {
        if (item.key === field.key) return result;
        if (item.type !== "formula" && item.type !== "hidden") {
          result.push({ key: item.key, label: item.label ?? item.key });
        }
      }
    }
    return result;
  }, [schema.sections, field.key]);

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="field-label">Label</Label>
        <Input
          id="field-label"
          value={field.label ?? ""}
          onChange={(event) =>
            updateField(field.key, { label: event.target.value })
          }
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="field-key">Key</Label>
        <Input
          id="field-key"
          value={field.key}
          onChange={(event) =>
            updateField(field.key, { key: event.target.value })
          }
        />
      </div>

      <div className="flex items-center justify-between">
        <Label htmlFor="field-required">Required</Label>
        <Switch
          id="field-required"
          checked={Boolean(field.required)}
          disabled={field.type === "formula"}
          onCheckedChange={(checked) =>
            updateField(field.key, { required: checked })
          }
        />
      </div>

      {field.type !== "formula" ? (
        <div className="space-y-2">
          <Label htmlFor="field-placeholder">Placeholder</Label>
          <Input
            id="field-placeholder"
            value={field.placeholder ?? ""}
            onChange={(event) =>
              updateField(field.key, { placeholder: event.target.value })
            }
          />
        </div>
      ) : null}

      <div className="space-y-2">
        <Label htmlFor="field-help">Help text</Label>
        <Textarea
          id="field-help"
          value={field.help_text ?? ""}
          onChange={(event) =>
            updateField(field.key, { help_text: event.target.value })
          }
          rows={2}
        />
      </div>

      {hasOptions ? (
        <div className="space-y-2">
          <Label htmlFor="field-options">Options (one per line)</Label>
          <Textarea
            id="field-options"
            value={(field.options ?? []).join("\n")}
            onChange={(event) =>
              updateField(field.key, {
                options: event.target.value
                  .split("\n")
                  .map((line) => line.trim())
                  .filter(Boolean),
              })
            }
            rows={4}
          />
        </div>
      ) : null}

      {field.type === "rating" ? (
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-2">
            <Label htmlFor="field-min">Min</Label>
            <Input
              id="field-min"
              type="number"
              value={field.min ?? 0}
              onChange={(event) =>
                updateField(field.key, { min: Number(event.target.value) })
              }
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="field-max">Max</Label>
            <Input
              id="field-max"
              type="number"
              value={field.max ?? 10}
              onChange={(event) =>
                updateField(field.key, { max: Number(event.target.value) })
              }
            />
          </div>
        </div>
      ) : null}

      {field.type === "formula" ? (
        <>
          <div className="space-y-2">
            <Label htmlFor="field-formula">Formula</Label>
            <Input
              id="field-formula"
              value={field.formula ?? ""}
              placeholder="{quantity} * {price}"
              onChange={(event) =>
                updateField(field.key, { formula: event.target.value })
              }
            />
            <p className="text-xs text-muted-foreground">
              Use {"{field_key}"} placeholders, e.g. {"{a} + {b}"}.
            </p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="field-format">Display format</Label>
            <Select
              value={field.format ?? "number"}
              onValueChange={(value: "number" | "currency") =>
                updateField(field.key, { format: value })
              }
            >
              <SelectTrigger id="field-format">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="number">Number</SelectItem>
                <SelectItem value="currency">Currency</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </>
      ) : null}

      {field.type !== "formula" ? (
        <ConditionalLogicEditor
          visibleWhen={field.visible_when}
          priorFields={priorFields}
          onChange={(visible_when) =>
            updateField(field.key, { visible_when })
          }
        />
      ) : null}

      <div className="flex gap-2 pt-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => duplicateFieldByKey(field.key)}
        >
          <Copy className="size-4" />
          Duplicate
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => removeField(field.key)}
        >
          <Trash2 className="size-4" />
          Delete
        </Button>
      </div>
    </div>
  );
};
