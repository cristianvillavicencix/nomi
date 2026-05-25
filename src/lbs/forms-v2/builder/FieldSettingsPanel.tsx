import { Copy, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
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
          onCheckedChange={(checked) =>
            updateField(field.key, { required: checked })
          }
        />
      </div>

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
