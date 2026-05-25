import {
  evaluateCondition,
  type VisibleWhen,
} from "./conditionalLogic.ts";
import { isFlexibleUrl } from "./urlValidation.ts";

export type FormFieldDef = {
  key: string;
  type?: string;
  label?: string;
  required?: boolean;
  options?: string[];
  min?: number;
  max?: number;
  min_items?: number;
  regex?: string;
  regex_message?: string;
  visible_when?: VisibleWhen;
};

export type FormSectionDef = {
  id: string;
  title?: string;
  fields: FormFieldDef[];
  visible_when?: VisibleWhen;
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

const isEmptyValue = (value: unknown): boolean =>
  value == null ||
  readString(value) === "" ||
  (Array.isArray(value) && value.length === 0);

const isTruthyCheckbox = (value: unknown): boolean =>
  value === true || value === "true" || value === "on";

const isSingleCheckboxField = (field: FormFieldDef): boolean =>
  field.type === "checkbox" && !(field.options && field.options.length > 0);

export const validateAnswersAgainstSchema = (
  answers: Record<string, unknown>,
  schema: FormSchema | null | undefined,
): string[] => {
  const errors: string[] = [];
  const sections = schema?.sections ?? [];

  for (const section of sections) {
    if (!evaluateCondition(section.visible_when, answers)) continue;

    for (const field of section.fields ?? []) {
      if (field.type === "formula") continue;
      if (!evaluateCondition(field.visible_when, answers)) continue;

      const value = answers[field.key];
      const label = field.label ?? field.key;

      if (
        field.type === "dynamic_file_groups" ||
        field.type === "file" ||
        field.type === "file_multi"
      ) {
        continue;
      }

      if (isSingleCheckboxField(field)) {
        if (field.required && !isTruthyCheckbox(value)) {
          errors.push(`${label} is required`);
        }
        continue;
      }

      if (field.type === "dynamic_list") {
        const items = Array.isArray(value)
          ? value.map((entry) => readString(entry)).filter(Boolean)
          : [];
        const minItems = field.min_items ?? (field.required ? 1 : 0);
        if (items.length < minItems) {
          errors.push(`${label} requires at least ${minItems} item(s)`);
        }
        continue;
      }

      if (field.required && isEmptyValue(value)) {
        errors.push(`${label} is required`);
        continue;
      }

      if (isEmptyValue(value)) continue;

      const stringValue = readString(value);

      switch (field.type) {
        case "email":
          if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(stringValue)) {
            errors.push(`${label} must be a valid email`);
          }
          break;
        case "phone":
          if (!/^[\d\s\-+().x]{7,25}$/i.test(stringValue)) {
            errors.push(`${label} must be a valid phone number`);
          }
          break;
        case "url":
          if (!isFlexibleUrl(stringValue)) {
            errors.push(`${label} must be a valid URL`);
          }
          break;
        case "number": {
          const num = Number(value);
          if (Number.isNaN(num)) {
            errors.push(`${label} must be a number`);
          } else {
            if (field.min !== undefined && num < field.min) {
              errors.push(`${label} must be >= ${field.min}`);
            }
            if (field.max !== undefined && num > field.max) {
              errors.push(`${label} must be <= ${field.max}`);
            }
          }
          break;
        }
        case "rating": {
          const num = Number(value);
          const min = field.min ?? 0;
          const max = field.max ?? 10;
          if (Number.isNaN(num) || num < min || num > max) {
            errors.push(`${label} must be between ${min} and ${max}`);
          }
          break;
        }
        case "select":
        case "radio":
          if (field.options && !field.options.includes(stringValue)) {
            errors.push(`${label} has an invalid option`);
          }
          break;
        case "checkbox":
          if (!Array.isArray(value)) {
            errors.push(`${label} must be a list`);
          } else if (field.options) {
            const invalid = value.filter(
              (item) => !field.options!.includes(String(item)),
            );
            if (invalid.length > 0) {
              errors.push(`${label} has invalid options`);
            }
          }
          break;
        case "multi_select":
          if (!Array.isArray(value)) {
            errors.push(`${label} must be a list`);
          } else if (field.options) {
            const invalid = value.filter(
              (item) => !field.options!.includes(String(item)),
            );
            if (invalid.length > 0) {
              errors.push(`${label} has invalid options`);
            }
          }
          break;
        case "date":
          if (!/^\d{4}-\d{2}-\d{2}/.test(stringValue)) {
            errors.push(`${label} must be a valid date`);
          }
          break;
      }

      if (field.regex && typeof value === "string") {
        try {
          if (!new RegExp(field.regex).test(value)) {
            errors.push(field.regex_message ?? `${label} format is invalid`);
          }
        } catch {
          // ignore invalid regex config
        }
      }
    }
  }

  return errors;
};

export const generateSecureToken = (): string => {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join(
    "",
  );
};
