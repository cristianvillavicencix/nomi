import type {
  FormFieldDef,
  FormSchemaV2,
  FormSectionDef,
} from "@/lbs/forms-v2/types";

const readValue = (answers: Record<string, unknown>, key: string): string => {
  const value = answers[key];
  if (value == null) return "";
  return String(value).trim();
};

export const matchesVisibleWhen = (
  visibleWhen: Record<string, string | string[]> | undefined,
  answers: Record<string, unknown>,
): boolean => {
  if (!visibleWhen || Object.keys(visibleWhen).length === 0) return true;

  return Object.entries(visibleWhen).every(([fieldKey, expected]) => {
    const actual = readValue(answers, fieldKey);
    if (Array.isArray(expected)) {
      return expected.includes(actual);
    }
    return actual === String(expected).trim();
  });
};

export const getVisibleSections = (
  schema: FormSchemaV2 | undefined,
  answers: Record<string, unknown>,
): FormSectionDef[] =>
  (schema?.sections ?? []).filter((section) =>
    matchesVisibleWhen(section.visible_when, answers),
  );

export const getVisibleFields = (
  section: FormSectionDef,
  answers: Record<string, unknown>,
): FormFieldDef[] =>
  (section.fields ?? []).filter((field) =>
    matchesVisibleWhen(field.visible_when, answers),
  );

export const validateSection = (
  section: FormSectionDef,
  answers: Record<string, unknown>,
): string[] => {
  const errors: string[] = [];
  for (const field of getVisibleFields(section, answers)) {
    if (!field.required) continue;
    const value = answers[field.key];
    const empty =
      value == null ||
      String(value).trim() === "" ||
      (Array.isArray(value) && value.length === 0);
    if (empty) {
      errors.push(`${field.label ?? field.key} is required`);
    }
  }
  return errors;
};

export const isLikelyFormToken = (value: string) =>
  /^[a-f0-9]{64}$/i.test(value.trim());
