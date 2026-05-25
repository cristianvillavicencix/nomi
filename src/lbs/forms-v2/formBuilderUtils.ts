import { toSlug } from "@/lib/toSlug";
import type {
  FormFieldDef,
  FormSchemaV2,
  FormSectionDef,
} from "@/lbs/forms-v2/types";

export const createFieldId = () =>
  `field_${Math.random().toString(36).slice(2, 10)}`;

export const createSectionId = () =>
  `section_${Math.random().toString(36).slice(2, 10)}`;

export const defaultFieldForType = (
  type: string,
  existingKeys: string[],
): FormFieldDef => {
  const baseLabel =
    type === "section" || type === "heading" || type === "divider"
      ? "New section"
      : type.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

  let key = toSlug(baseLabel) || type;
  let suffix = 2;
  while (existingKeys.includes(key)) {
    key = `${toSlug(baseLabel) || type}-${suffix}`;
    suffix += 1;
  }

  const field: FormFieldDef = {
    key,
    type: type as FormFieldDef["type"],
    label: baseLabel,
    required: false,
  };

  if (["select", "radio", "multi_select"].includes(type)) {
    field.options = ["Option 1", "Option 2"];
  }
  if (type === "rating") {
    field.min = 0;
    field.max = 10;
  }
  if (type === "file") {
    field.accept = ".pdf,.doc,.docx,.png,.jpg";
  }
  if (type === "formula") {
    field.formula = "{field_a} + {field_b}";
    field.format = "currency";
  }

  return field;
};

export const duplicateField = (
  field: FormFieldDef,
  existingKeys: string[],
): FormFieldDef => {
  const copy = structuredClone(field);
  copy.key = `${field.key}-copy`;
  let suffix = 2;
  while (existingKeys.includes(copy.key)) {
    copy.key = `${field.key}-copy-${suffix}`;
    suffix += 1;
  }
  copy.label = `${field.label ?? field.key} (copy)`;
  return copy;
};

export const emptySchema = (): FormSchemaV2 => ({
  sections: [
    {
      id: createSectionId(),
      title: "Section 1",
      fields: [],
    },
  ],
});

export const allFieldKeys = (schema: FormSchemaV2): string[] =>
  (schema.sections ?? []).flatMap((section) =>
    (section.fields ?? []).map((field) => field.key),
  );

export const findFieldLocation = (
  schema: FormSchemaV2,
  fieldKey: string,
): { sectionId: string; fieldIndex: number } | null => {
  for (const section of schema.sections ?? []) {
    const fieldIndex = (section.fields ?? []).findIndex(
      (f) => f.key === fieldKey,
    );
    if (fieldIndex >= 0) {
      return { sectionId: section.id, fieldIndex };
    }
  }
  return null;
};

export const updateSection = (
  schema: FormSchemaV2,
  sectionId: string,
  patch: Partial<FormSectionDef>,
): FormSchemaV2 => ({
  sections: (schema.sections ?? []).map((section) =>
    section.id === sectionId ? { ...section, ...patch } : section,
  ),
});

export const relativeTime = (value?: string | null) => {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  const diffMs = Date.now() - date.getTime();
  const minutes = Math.floor(diffMs / 60000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  return date.toLocaleDateString();
};
