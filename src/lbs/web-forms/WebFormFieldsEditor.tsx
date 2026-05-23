import { Plus, Trash2 } from "lucide-react";
import { useFormContext, useWatch } from "react-hook-form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  DEFAULT_CUSTOM_FORM_SCHEMA,
  slugifyCustomFormFieldKey,
  type CustomFormField,
  type CustomFormSchema,
} from "@/lbs/web-forms/customFormSchema";

export const WebFormFieldsEditor = () => {
  const { setValue } = useFormContext();
  const schema = useWatch({ name: "schema" }) as CustomFormSchema | undefined;
  const fields = schema?.fields ?? DEFAULT_CUSTOM_FORM_SCHEMA.fields;

  const updateFields = (next: CustomFormField[]) => {
    setValue("schema", { type: "custom", fields: next }, { shouldDirty: true });
  };

  const addField = () => {
    const label = `Field ${fields.length + 1}`;
    updateFields([
      ...fields,
      {
        key: slugifyCustomFormFieldKey(label),
        label,
        required: false,
      },
    ]);
  };

  return (
    <div className="space-y-3 rounded-lg border p-4">
      <div>
        <h3 className="text-sm font-medium">Form fields</h3>
        <p className="mt-1 text-xs text-muted-foreground">
          These fields appear on the public page at /forms/your-slug.
        </p>
      </div>

      <div className="space-y-3">
        {fields.map((field, index) => (
          <div
            key={`${field.key}-${index}`}
            className="space-y-3 rounded-md border p-3"
          >
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor={`field-label-${index}`}>Label</Label>
                <Input
                  id={`field-label-${index}`}
                  value={field.label}
                  onChange={(event) => {
                    const label = event.target.value;
                    const next = [...fields];
                    next[index] = {
                      ...field,
                      label,
                      key: slugifyCustomFormFieldKey(label || field.key),
                    };
                    updateFields(next);
                  }}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor={`field-key-${index}`}>Key</Label>
                <Input
                  id={`field-key-${index}`}
                  value={field.key}
                  onChange={(event) => {
                    const next = [...fields];
                    next[index] = {
                      ...field,
                      key: slugifyCustomFormFieldKey(event.target.value),
                    };
                    updateFields(next);
                  }}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor={`field-placeholder-${index}`}>Placeholder</Label>
              <Input
                id={`field-placeholder-${index}`}
                value={field.placeholder ?? ""}
                onChange={(event) => {
                  const next = [...fields];
                  next[index] = {
                    ...field,
                    placeholder: event.target.value || undefined,
                  };
                  updateFields(next);
                }}
              />
            </div>

            <div className="flex flex-wrap items-center gap-6">
              <label className="flex items-center gap-2 text-sm">
                <Switch
                  checked={Boolean(field.required)}
                  onCheckedChange={(checked) => {
                    const next = [...fields];
                    next[index] = { ...field, required: checked };
                    updateFields(next);
                  }}
                />
                Required
              </label>
              <label className="flex items-center gap-2 text-sm">
                <Switch
                  checked={Boolean(field.multiline)}
                  onCheckedChange={(checked) => {
                    const next = [...fields];
                    next[index] = { ...field, multiline: checked };
                    updateFields(next);
                  }}
                />
                Multiline
              </label>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="ml-auto text-destructive hover:text-destructive"
                disabled={fields.length <= 1}
                onClick={() =>
                  updateFields(fields.filter((_, i) => i !== index))
                }
              >
                <Trash2 className="mr-1 size-4" />
                Remove
              </Button>
            </div>
          </div>
        ))}
      </div>

      <Button type="button" variant="outline" size="sm" onClick={addField}>
        <Plus className="mr-1 size-4" />
        Add field
      </Button>
    </div>
  );
};
