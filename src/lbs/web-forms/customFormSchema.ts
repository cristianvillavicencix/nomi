export type CustomFormField = {
  key: string;
  label: string;
  multiline?: boolean;
  required?: boolean;
  placeholder?: string;
};

export type CustomFormSchema = {
  type: "custom";
  fields: CustomFormField[];
};

export const DEFAULT_CUSTOM_FORM_SCHEMA: CustomFormSchema = {
  type: "custom",
  fields: [
    {
      key: "message",
      label: "Message",
      multiline: true,
      required: true,
      placeholder: "Tell us what you need…",
    },
  ],
};

export const slugifyCustomFormFieldKey = (label: string) =>
  label
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .replace(/_+/g, "_") || "field";

const isCustomFormField = (value: unknown): value is CustomFormField => {
  if (!value || typeof value !== "object") return false;
  const field = value as CustomFormField;
  return Boolean(field.key?.trim() && field.label?.trim());
};

export const parseCustomFormSchema = (
  schema?: Record<string, unknown> | null,
): CustomFormSchema => {
  if (schema?.type === "custom" && Array.isArray(schema.fields)) {
    const fields = schema.fields.filter(isCustomFormField).map((field) => ({
      key: field.key.trim(),
      label: field.label.trim(),
      multiline: Boolean(field.multiline),
      required: Boolean(field.required),
      placeholder: field.placeholder?.trim() || undefined,
    }));

    if (fields.length > 0) {
      return { type: "custom", fields };
    }
  }

  return DEFAULT_CUSTOM_FORM_SCHEMA;
};

export const emptyCustomFormValues = (schema: CustomFormSchema) =>
  Object.fromEntries(schema.fields.map((field) => [field.key, ""])) as Record<
    string,
    string
  >;

export const validateCustomFormValues = (
  schema: CustomFormSchema,
  values: Record<string, string>,
) => {
  const missing = schema.fields
    .filter((field) => field.required)
    .filter((field) => !values[field.key]?.trim())
    .map((field) => field.label);

  if (missing.length === 0) return undefined;
  return `Required: ${missing.join(", ")}`;
};
