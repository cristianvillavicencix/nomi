import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { useDroppable } from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useFormBuilder } from "@/lbs/forms-v2/builder/FormBuilderContext";
import { FieldPreview } from "@/lbs/forms-v2/builder/FieldPreview";
import type { FormFieldDef } from "@/lbs/forms-v2/types";
import { cn } from "@/lib/utils";

const SortableField = ({
  field,
  sectionId,
}: {
  field: FormFieldDef;
  sectionId: string;
}) => {
  const { selectedFieldKey, selectField } = useFormBuilder();
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: `field:${field.key}`,
    data: { type: "field", sectionId, fieldKey: field.key },
  });

  return (
    <div
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.4 : 1,
      }}
      className="flex items-start gap-2"
    >
      <button
        type="button"
        className="mt-3 rounded p-1 text-muted-foreground hover:bg-muted"
        aria-label="Drag field"
        {...attributes}
        {...listeners}
      >
        <GripVertical className="size-4" />
      </button>
      <div className="flex-1">
        <FieldPreview
          field={field}
          selected={selectedFieldKey === field.key}
          onClick={() => selectField(field.key)}
        />
      </div>
    </div>
  );
};

const SectionDropZone = ({
  sectionId,
  children,
  empty,
}: {
  sectionId: string;
  children: React.ReactNode;
  empty: boolean;
}) => {
  const { setNodeRef, isOver } = useDroppable({
    id: `section-drop:${sectionId}`,
    data: { sectionId },
  });

  return (
    <div
      ref={setNodeRef}
      className={cn(
        "min-h-[80px] space-y-3 rounded-lg border border-dashed p-3",
        empty ? "bg-muted/20" : "",
        isOver ? "border-primary bg-primary/5" : "",
      )}
    >
      {children}
    </div>
  );
};

export const FormCanvas = () => {
  const { schema, addSection, updateSectionById } = useFormBuilder();

  return (
    <div className="space-y-4">
      {(schema.sections ?? []).length === 0 ? (
        <div className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
          Drag fields here or add a section to get started.
        </div>
      ) : null}

      {(schema.sections ?? []).map((section) => (
        <section
          key={section.id}
          className="space-y-3 rounded-xl border bg-background p-4"
        >
          <Input
            value={section.title ?? ""}
            onChange={(event) =>
              updateSectionById(section.id, { title: event.target.value })
            }
            placeholder="Section title"
            className="font-medium"
          />

          <SortableContext
            items={(section.fields ?? []).map((field) => `field:${field.key}`)}
            strategy={verticalListSortingStrategy}
          >
            <SectionDropZone
              sectionId={section.id}
              empty={(section.fields ?? []).length === 0}
            >
              {(section.fields ?? []).map((field) => (
                <SortableField
                  key={field.key}
                  field={field}
                  sectionId={section.id}
                />
              ))}
              {(section.fields ?? []).length === 0 ? (
                <p className="text-center text-sm text-muted-foreground">
                  Drop fields here
                </p>
              ) : null}
            </SectionDropZone>
          </SortableContext>
        </section>
      ))}

      <Button type="button" variant="outline" onClick={addSection}>
        <Plus className="size-4" />
        Add section
      </Button>
    </div>
  );
};
