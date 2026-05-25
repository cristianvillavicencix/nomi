import { useDraggable } from "@dnd-kit/core";
import { useMemo, useState } from "react";
import { Input } from "@/components/ui/input";
import {
  FIELD_PALETTE,
  PALETTE_CATEGORIES,
} from "@/lbs/forms-v2/formBuilderConstants";
import { cn } from "@/lib/utils";

const DraggablePaletteItem = ({
  type,
  label,
}: {
  type: string;
  label: string;
}) => {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `palette:${type}`,
    data: { type: "palette", paletteType: type },
  });

  return (
    <button
      ref={setNodeRef}
      type="button"
      className={cn(
        "w-full rounded-md border px-3 py-2 text-left text-sm hover:bg-muted",
        isDragging ? "opacity-50" : "",
      )}
      {...listeners}
      {...attributes}
    >
      {label}
    </button>
  );
};

export const FieldPalette = () => {
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return FIELD_PALETTE;
    return FIELD_PALETTE.filter((item) => item.label.toLowerCase().includes(q));
  }, [query]);

  return (
    <div className="space-y-4">
      <Input
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder="Search field types…"
      />
      {PALETTE_CATEGORIES.map((category) => {
        const items = filtered.filter((item) => item.category === category.id);
        if (items.length === 0) return null;
        return (
          <div key={category.id} className="space-y-2">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              {category.label}
            </p>
            <div className="space-y-2">
              {items.map((item) => (
                <DraggablePaletteItem
                  key={item.type}
                  type={item.type}
                  label={item.label}
                />
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
};
