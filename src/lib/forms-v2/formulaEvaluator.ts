import { evaluate } from "mathjs";
import type { FormulaFormat } from "@/lbs/forms-v2/types";

export const evaluateFormula = (
  formula: string | undefined,
  answers: Record<string, unknown>,
): number | null => {
  if (!formula?.trim()) return null;

  try {
    const expression = formula.replace(/\{(\w+)\}/g, (_, key: string) => {
      const value = Number(answers[key]);
      return Number.isFinite(value) ? String(value) : "0";
    });
    const result = evaluate(expression);
    return typeof result === "number" && Number.isFinite(result) ? result : null;
  } catch {
    return null;
  }
};

export const formatFormulaValue = (
  value: number | null,
  format: FormulaFormat = "number",
): string => {
  if (value == null) return "—";
  if (format === "currency") {
    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency: "USD",
    }).format(value);
  }
  return new Intl.NumberFormat(undefined, {
    maximumFractionDigits: 4,
  }).format(value);
};

export const buildFormulaAnswers = (
  schema: { sections?: { fields?: { key: string; type?: string; formula?: string }[] }[] } | undefined,
  answers: Record<string, unknown>,
): Record<string, unknown> => {
  const next = { ...answers };
  for (const section of schema?.sections ?? []) {
    for (const field of section.fields ?? []) {
      if (field.type !== "formula" || !field.formula) continue;
      const value = evaluateFormula(field.formula, next);
      if (value != null) next[field.key] = value;
    }
  }
  return next;
};
