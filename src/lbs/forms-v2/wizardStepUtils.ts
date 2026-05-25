import {
  getVisibleFields,
  getVisibleSections,
} from "@/lbs/forms-v2/formSchemaUtils";
import type { FormFieldDef, FormSchemaV2, FormSectionDef } from "@/lbs/forms-v2/types";

export type WizardStep =
  | { kind: "section"; section: FormSectionDef; sectionIndex: number }
  | {
      kind: "dynamic_file_group";
      section: FormSectionDef;
      field: FormFieldDef;
      groupKey: string;
      groupIndex: number;
      groupTotal: number;
    }
  | { kind: "summary" };

export const readStringList = (value: unknown): string[] => {
  if (!Array.isArray(value)) return [];
  return value
    .map((entry) => (typeof entry === "string" ? entry.trim() : ""))
    .filter(Boolean);
};

export const expandWizardSteps = (
  schema: FormSchemaV2 | undefined,
  answers: Record<string, unknown>,
): WizardStep[] => {
  const sections = getVisibleSections(schema, answers);
  const steps: WizardStep[] = [];

  sections.forEach((section, sectionIndex) => {
    const groupField = getVisibleFields(section, answers).find(
      (field) => field.type === "dynamic_file_groups",
    );

    if (groupField) {
      const dependsOn = groupField.depends_on ?? groupField.key;
      const groups = readStringList(answers[dependsOn]);
      if (groups.length === 0) {
        steps.push({ kind: "section", section, sectionIndex });
        return;
      }
      groups.forEach((groupKey, groupIndex) => {
        steps.push({
          kind: "dynamic_file_group",
          section,
          field: groupField,
          groupKey,
          groupIndex,
          groupTotal: groups.length,
        });
      });
      return;
    }

    steps.push({ kind: "section", section, sectionIndex });
  });

  if (schema?.settings?.show_summary_step) {
    steps.push({ kind: "summary" });
  }

  return steps;
};

export const countWizardSteps = (
  schema: FormSchemaV2 | undefined,
  answers: Record<string, unknown>,
): number => expandWizardSteps(schema, answers).length;
