import { Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { FormFieldDef } from "@/lbs/forms-v2/types";
import { readStringList } from "@/lbs/forms-v2/wizardStepUtils";

type DynamicListFieldProps = {
  field: FormFieldDef;
  value: unknown;
  disabled?: boolean;
  onChange: (next: string[]) => void;
};

const formatItemLabel = (field: FormFieldDef, index: number) =>
  (field.item_label_template ?? "Item {index}").replace(
    "{index}",
    String(index + 1),
  );

export const DynamicListField = ({
  field,
  value,
  disabled,
  onChange,
}: DynamicListFieldProps) => {
  const items = readStringList(value);
  const minItems = field.min_items ?? 1;

  const updateItem = (index: number, nextValue: string) => {
    const next = [...items];
    next[index] = nextValue;
    onChange(next);
  };

  const removeItem = (index: number) => {
    if (items.length <= minItems) return;
    onChange(items.filter((_, itemIndex) => itemIndex !== index));
  };

  const addItem = () => {
    onChange([...items, ""]);
  };

  const visibleItems = items.length > 0 ? items : Array.from({ length: minItems }, () => "");

  return (
    <div className="space-y-3">
      {visibleItems.map((item, index) => (
        <div key={`${field.key}-${index}`} className="space-y-1">
          <Label htmlFor={`${field.key}-${index}`}>{formatItemLabel(field, index)}</Label>
          <div className="flex gap-2">
            <Input
              id={`${field.key}-${index}`}
              value={item}
              disabled={disabled}
              placeholder={field.item_placeholder}
              onChange={(event) => updateItem(index, event.target.value)}
            />
            {visibleItems.length > minItems ? (
              <Button
                type="button"
                variant="outline"
                size="icon"
                disabled={disabled}
                aria-label={`Remove ${formatItemLabel(field, index)}`}
                onClick={() => removeItem(index)}
              >
                <X className="size-4" />
              </Button>
            ) : null}
          </div>
        </div>
      ))}
      <Button type="button" variant="outline" size="sm" disabled={disabled} onClick={addItem}>
        <Plus className="size-4" />
        {field.add_button_label ?? "Add item"}
      </Button>
    </div>
  );
};
