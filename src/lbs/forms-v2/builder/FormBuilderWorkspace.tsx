import { useMemo, useState } from "react";
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { arrayMove } from "@dnd-kit/sortable";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useFormBuilder } from "@/lbs/forms-v2/builder/FormBuilderContext";
import { FieldPalette } from "@/lbs/forms-v2/builder/FieldPalette";
import { FormCanvas } from "@/lbs/forms-v2/builder/FormCanvas";
import { FieldSettingsPanel } from "@/lbs/forms-v2/builder/FieldSettingsPanel";
import { FieldPreview } from "@/lbs/forms-v2/builder/FieldPreview";
import type { FormFieldDef } from "@/lbs/forms-v2/types";

type FormBuilderWorkspaceProps = {
  layout?: "desktop" | "mobile";
};

export const FormBuilderWorkspace = ({
  layout = "desktop",
}: FormBuilderWorkspaceProps) => {
  const { schema, addField, moveField } = useFormBuilder();
  const [activeId, setActiveId] = useState<string | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor),
  );

  const activeField = useMemo(() => {
    if (!activeId?.startsWith("field:")) return null;
    const fieldKey = activeId.replace("field:", "");
    for (const section of schema.sections ?? []) {
      const field = section.fields?.find((item) => item.key === fieldKey);
      if (field) return field;
    }
    return null;
  }, [activeId, schema.sections]);

  const onDragStart = (event: DragStartEvent) => {
    setActiveId(String(event.active.id));
  };

  const onDragEnd = (event: DragEndEvent) => {
    setActiveId(null);
    const { active, over } = event;
    if (!over) return;

    const activeIdStr = String(active.id);
    const overIdStr = String(over.id);

    if (activeIdStr.startsWith("palette:")) {
      const paletteType = activeIdStr.replace("palette:", "");
      const sectionId = over.data.current?.sectionId as string | undefined;
      if (sectionId) addField(sectionId, paletteType);
      return;
    }

    if (!activeIdStr.startsWith("field:")) return;
    const fieldKey = activeIdStr.replace("field:", "");
    const sourceSectionId = active.data.current?.sectionId as string;
    const targetSectionId =
      (over.data.current?.sectionId as string | undefined) ??
      (overIdStr.startsWith("section-drop:")
        ? overIdStr.replace("section-drop:", "")
        : undefined);
    if (!sourceSectionId || !targetSectionId) return;

    const sourceSection = schema.sections?.find(
      (s) => s.id === sourceSectionId,
    );
    const targetSection = schema.sections?.find(
      (s) => s.id === targetSectionId,
    );
    if (!sourceSection || !targetSection) return;

    const oldIndex = (sourceSection.fields ?? []).findIndex(
      (field) => field.key === fieldKey,
    );
    if (oldIndex < 0) return;

    if (sourceSectionId === targetSectionId) {
      const overFieldKey = over.data.current?.fieldKey as string | undefined;
      if (!overFieldKey || overFieldKey === fieldKey) return;
      const newIndex = (sourceSection.fields ?? []).findIndex(
        (field) => field.key === overFieldKey,
      );
      if (newIndex < 0) return;
      const reordered = arrayMove(
        sourceSection.fields ?? [],
        oldIndex,
        newIndex,
      );
      moveField(fieldKey, sourceSectionId, newIndex);
      void reordered;
      return;
    }

    moveField(fieldKey, targetSectionId, targetSection.fields?.length ?? 0);
  };

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
    >
      {layout === "mobile" ? (
        <Tabs defaultValue="canvas" className="mt-2">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="fields">Fields</TabsTrigger>
            <TabsTrigger value="canvas">Canvas</TabsTrigger>
            <TabsTrigger value="settings">Settings</TabsTrigger>
          </TabsList>
          <TabsContent value="fields" className="rounded-xl border p-4">
            <FieldPalette />
          </TabsContent>
          <TabsContent value="canvas" className="rounded-xl border p-4">
            <FormCanvas />
          </TabsContent>
          <TabsContent value="settings" className="rounded-xl border p-4">
            <FieldSettingsPanel />
          </TabsContent>
        </Tabs>
      ) : (
        <div className="grid gap-4 lg:grid-cols-[240px_minmax(0,1fr)_300px]">
          <aside className="rounded-xl border bg-card p-4 lg:sticky lg:top-20 lg:max-h-[calc(100vh-6rem)] lg:overflow-y-auto">
            <FieldPalette />
          </aside>
          <main className="min-w-0 rounded-xl border bg-card p-4">
            <FormCanvas />
          </main>
          <aside className="rounded-xl border bg-card p-4 lg:sticky lg:top-20 lg:max-h-[calc(100vh-6rem)] lg:overflow-y-auto">
            <FieldSettingsPanel />
          </aside>
        </div>
      )}

      <DragOverlay>
        {activeField ? (
          <div className="rounded-lg border bg-background p-3 shadow-lg">
            <FieldPreview field={activeField as FormFieldDef} />
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
};
