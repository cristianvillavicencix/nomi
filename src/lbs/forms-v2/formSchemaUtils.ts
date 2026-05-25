import { evaluateCondition } from "@/lib/forms-v2/conditionalLogic";
import { readStringList } from "@/lbs/forms-v2/wizardStepUtils";
import type {
  FormFieldDef,
  FormSchemaV2,
  FormSectionDef,
  VisibleWhen,
} from "@/lbs/forms-v2/types";

export const matchesVisibleWhen = (
  visibleWhen: VisibleWhen | undefined,
  answers: Record<string, unknown>,
): boolean => evaluateCondition(visibleWhen, answers);

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
  (section.fields ?? []).filter(
    (field) =>
      field.type !== "formula" &&
      matchesVisibleWhen(field.visible_when, answers),
  );

export const getVisibleFormulaFields = (
  section: FormSectionDef,
  answers: Record<string, unknown>,
): FormFieldDef[] =>
  (section.fields ?? []).filter(
    (field) =>
      field.type === "formula" &&
      matchesVisibleWhen(field.visible_when, answers),
  );

export const validateSection = (
  section: FormSectionDef,
  answers: Record<string, unknown>,
): string[] => {
  const errors: string[] = [];
  for (const [fieldKey, message] of Object.entries(
    validateSectionFields(section, answers),
  )) {
    void fieldKey;
    errors.push(message);
  }
  return errors;
};

export const validateSectionFields = (
  section: FormSectionDef,
  answers: Record<string, unknown>,
): Record<string, string> => {
  const errors: Record<string, string> = {};
  for (const field of getVisibleFields(section, answers)) {
    if (field.type === "dynamic_list") {
      const items = readStringList(answers[field.key]);
      const minItems = field.min_items ?? (field.required ? 1 : 0);
      const filled = items.filter(Boolean);
      if (field.required && filled.length < minItems) {
        errors[field.key] = `${field.label ?? field.key} requires at least ${minItems} item(s)`;
      }
      continue;
    }

    if (field.type === "dynamic_file_groups") {
      continue;
    }

    if (!field.required) continue;
    const value = answers[field.key];
    const empty =
      value == null ||
      String(value).trim() === "" ||
      (Array.isArray(value) && value.length === 0);
    if (empty) {
      errors[field.key] = `${field.label ?? field.key} is required`;
    }
  }
  return errors;
};

/** v2 public links use 64-char tokens (legacy slugs are short, e.g. project-resources). */
export const isLikelyFormToken = (value: string) =>
  value.trim().length === 64;

export type WizardMode = "auto" | "on" | "off";

export const resolveWizardEnabled = (
  schema: FormSchemaV2 | undefined,
): boolean => {
  const sections = schema?.sections ?? [];
  const mode = schema?.settings?.wizard_mode ?? "auto";
  const allTitled =
    sections.length > 0 &&
    sections.every((section) => Boolean(section.title?.trim()));

  if (mode === "on") return sections.length > 0;
  if (mode === "off") return false;
  return sections.length > 1 && allTitled;
};

export const formProgressStorageKey = (token: string) =>
  `form_progress_${token}`;
