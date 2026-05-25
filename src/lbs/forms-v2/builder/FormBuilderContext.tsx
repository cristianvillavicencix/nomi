import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useNotify, useUpdate } from "ra-core";
import type {
  FormFieldDef,
  FormInstance,
  FormSchemaV2,
} from "@/lbs/forms-v2/types";
import {
  allFieldKeys,
  createSectionId,
  defaultFieldForType,
  duplicateField,
  findFieldLocation,
  updateSection,
} from "@/lbs/forms-v2/formBuilderUtils";

type FormBuilderContextValue = {
  formInstance: FormInstance;
  schema: FormSchemaV2;
  selectedFieldKey: string | null;
  isDirty: boolean;
  isSaving: boolean;
  setFormInstance: (patch: Partial<FormInstance>) => void;
  setSchema: (schema: FormSchemaV2) => void;
  selectField: (fieldKey: string | null) => void;
  addField: (sectionId: string, type: string, index?: number) => void;
  removeField: (fieldKey: string) => void;
  updateField: (fieldKey: string, patch: Partial<FormFieldDef>) => void;
  duplicateFieldByKey: (fieldKey: string) => void;
  moveField: (
    fieldKey: string,
    targetSectionId: string,
    targetIndex: number,
  ) => void;
  addSection: () => void;
  updateSectionById: (sectionId: string, patch: { title?: string }) => void;
  removeSection: (sectionId: string) => void;
  save: () => Promise<void>;
};

const FormBuilderContext = createContext<FormBuilderContextValue | null>(null);

export const useFormBuilder = () => {
  const ctx = useContext(FormBuilderContext);
  if (!ctx) {
    throw new Error("useFormBuilder must be used within FormBuilderProvider");
  }
  return ctx;
};

export const FormBuilderProvider = ({
  initialInstance,
  children,
}: {
  initialInstance: FormInstance;
  children: ReactNode;
}) => {
  const notify = useNotify();
  const [update] = useUpdate();
  const [formInstance, setFormInstanceState] = useState(initialInstance);
  const [schema, setSchemaState] = useState<FormSchemaV2>(
    initialInstance.schema ?? { sections: [] },
  );
  const [selectedFieldKey, setSelectedFieldKey] = useState<string | null>(null);
  const [isDirty, setIsDirty] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const saveTimer = useRef<number | null>(null);

  const markDirty = useCallback(() => setIsDirty(true), []);

  const setFormInstance = useCallback(
    (patch: Partial<FormInstance>) => {
      setFormInstanceState((current) => ({ ...current, ...patch }));
      markDirty();
    },
    [markDirty],
  );

  const setSchema = useCallback(
    (next: FormSchemaV2) => {
      setSchemaState(next);
      markDirty();
    },
    [markDirty],
  );

  const save = useCallback(async () => {
    setIsSaving(true);
    try {
      await update(
        "form_instances",
        {
          id: formInstance.id,
          data: {
            ...formInstance,
            schema,
          },
        },
        { returnPromise: true },
      );
      setIsDirty(false);
      notify("Form saved", { type: "info" });
    } catch (error) {
      notify(error instanceof Error ? error.message : "Failed to save form", {
        type: "error",
      });
      throw error;
    } finally {
      setIsSaving(false);
    }
  }, [formInstance, notify, schema, update]);

  useEffect(() => {
    if (!isDirty || isSaving) return;
    if (saveTimer.current) window.clearTimeout(saveTimer.current);
    saveTimer.current = window.setTimeout(() => {
      void save().catch(() => undefined);
    }, 3000);
    return () => {
      if (saveTimer.current) window.clearTimeout(saveTimer.current);
    };
  }, [isDirty, isSaving, save, schema, formInstance]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "s") {
        event.preventDefault();
        void save().catch(() => undefined);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [save]);

  const addField = useCallback(
    (sectionId: string, type: string, index?: number) => {
      if (type === "section") {
        setSchemaState((current) => ({
          sections: [
            ...(current.sections ?? []),
            {
              id: createSectionId(),
              title: "New section",
              fields: [],
            },
          ],
        }));
        markDirty();
        return;
      }

      const keys = allFieldKeys(schema);
      const field = defaultFieldForType(type, keys);
      if (type === "heading" || type === "divider") {
        field.type = type;
      }

      setSchemaState((current) => ({
        sections: (current.sections ?? []).map((section) => {
          if (section.id !== sectionId) return section;
          const fields = [...(section.fields ?? [])];
          const insertAt =
            index == null || index < 0 || index > fields.length
              ? fields.length
              : index;
          fields.splice(insertAt, 0, field);
          return { ...section, fields };
        }),
      }));
      setSelectedFieldKey(field.key);
      markDirty();
    },
    [markDirty, schema],
  );

  const removeField = useCallback(
    (fieldKey: string) => {
      setSchemaState((current) => ({
        sections: (current.sections ?? []).map((section) => ({
          ...section,
          fields: (section.fields ?? []).filter(
            (field) => field.key !== fieldKey,
          ),
        })),
      }));
      setSelectedFieldKey((current) => (current === fieldKey ? null : current));
      markDirty();
    },
    [markDirty],
  );

  const updateField = useCallback(
    (fieldKey: string, patch: Partial<FormFieldDef>) => {
      setSchemaState((current) => ({
        sections: (current.sections ?? []).map((section) => ({
          ...section,
          fields: (section.fields ?? []).map((field) =>
            field.key === fieldKey ? { ...field, ...patch } : field,
          ),
        })),
      }));
      markDirty();
    },
    [markDirty],
  );

  const duplicateFieldByKey = useCallback(
    (fieldKey: string) => {
      const location = findFieldLocation(schema, fieldKey);
      if (!location) return;
      const section = schema.sections?.find((s) => s.id === location.sectionId);
      const field = section?.fields?.[location.fieldIndex];
      if (!field) return;
      const copy = duplicateField(field, allFieldKeys(schema));
      setSchemaState((current) => ({
        sections: (current.sections ?? []).map((s) => {
          if (s.id !== location.sectionId) return s;
          const fields = [...(s.fields ?? [])];
          fields.splice(location.fieldIndex + 1, 0, copy);
          return { ...s, fields };
        }),
      }));
      setSelectedFieldKey(copy.key);
      markDirty();
    },
    [markDirty, schema],
  );

  const moveField = useCallback(
    (fieldKey: string, targetSectionId: string, targetIndex: number) => {
      setSchemaState((current) => {
        let moving: FormFieldDef | null = null;
        const sections = (current.sections ?? []).map((section) => {
          const fields = (section.fields ?? []).filter((field) => {
            if (field.key === fieldKey) {
              moving = field;
              return false;
            }
            return true;
          });
          return { ...section, fields };
        });
        if (!moving) return current;
        return {
          sections: sections.map((section) => {
            if (section.id !== targetSectionId) return section;
            const fields = [...(section.fields ?? [])];
            fields.splice(targetIndex, 0, moving!);
            return { ...section, fields };
          }),
        };
      });
      markDirty();
    },
    [markDirty],
  );

  const addSection = useCallback(() => {
    setSchemaState((current) => ({
      sections: [
        ...(current.sections ?? []),
        { id: createSectionId(), title: "New section", fields: [] },
      ],
    }));
    markDirty();
  }, [markDirty]);

  const updateSectionById = useCallback(
    (sectionId: string, patch: { title?: string }) => {
      setSchemaState((current) => updateSection(current, sectionId, patch));
      markDirty();
    },
    [markDirty],
  );

  const removeSection = useCallback(
    (sectionId: string) => {
      setSchemaState((current) => ({
        sections: (current.sections ?? []).filter(
          (section) => section.id !== sectionId,
        ),
      }));
      markDirty();
    },
    [markDirty],
  );

  const value = useMemo(
    () => ({
      formInstance,
      schema,
      selectedFieldKey,
      isDirty,
      isSaving,
      setFormInstance,
      setSchema,
      selectField: setSelectedFieldKey,
      addField,
      removeField,
      updateField,
      duplicateFieldByKey,
      moveField,
      addSection,
      updateSectionById,
      removeSection,
      save,
    }),
    [
      formInstance,
      schema,
      selectedFieldKey,
      isDirty,
      isSaving,
      setFormInstance,
      setSchema,
      addField,
      removeField,
      updateField,
      duplicateFieldByKey,
      moveField,
      addSection,
      updateSectionById,
      removeSection,
      save,
    ],
  );

  return (
    <FormBuilderContext.Provider value={value}>
      {children}
    </FormBuilderContext.Provider>
  );
};
