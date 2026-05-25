export type FormFieldDef = {
  key: string;
  type?: string;
  label?: string;
  required?: boolean;
  options?: string[];
  visible_when?: Record<string, string | string[]>;
};

export type FormSectionDef = {
  id: string;
  title?: string;
  fields: FormFieldDef[];
  visible_when?: Record<string, string | string[]>;
};

export type FormSchema = {
  sections?: FormSectionDef[];
};

const readString = (value: unknown): string => {
  if (value == null) return "";
  if (typeof value === "string") return value.trim();
  if (typeof value === "number" || typeof value === "boolean") {
    return String(value).trim();
  }
  return "";
};

const matchesVisibleWhen = (
  visibleWhen: Record<string, string | string[]> | undefined,
  answers: Record<string, unknown>,
): boolean => {
  if (!visibleWhen || Object.keys(visibleWhen).length === 0) return true;

  return Object.entries(visibleWhen).every(([fieldKey, expected]) => {
    const actual = readString(answers[fieldKey]);
    if (Array.isArray(expected)) {
      return expected.includes(actual);
    }
    return actual === readString(expected);
  });
};

export const extractFieldValue = (
  answers: Record<string, unknown>,
  keys: string[],
): string | null => {
  for (const key of keys) {
    const value = readString(answers[key]);
    if (value) return value;
  }
  return null;
};

export const validateAnswersAgainstSchema = (
  answers: Record<string, unknown>,
  schema: FormSchema | null | undefined,
): string[] => {
  const errors: string[] = [];
  const sections = schema?.sections ?? [];

  for (const section of sections) {
    if (!matchesVisibleWhen(section.visible_when, answers)) continue;

    for (const field of section.fields ?? []) {
      if (!matchesVisibleWhen(field.visible_when, answers)) continue;
      if (!field.required) continue;

      const value = answers[field.key];
      const isEmpty =
        value == null ||
        readString(value) === "" ||
        (Array.isArray(value) && value.length === 0);

      if (isEmpty) {
        errors.push(`${field.label ?? field.key} is required`);
      }
    }
  }

  return errors;
};

export const generateSecureToken = (): string => {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "hex")).join(
    "",
  );
};
