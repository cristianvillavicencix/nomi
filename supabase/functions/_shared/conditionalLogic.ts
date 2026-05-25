export type ConditionOperator =
  | "equals"
  | "not_equals"
  | "contains"
  | "not_contains"
  | "greater_than"
  | "less_than"
  | "greater_or_equal"
  | "less_or_equal"
  | "is_empty"
  | "is_not_empty"
  | "in"
  | "not_in";

export type SingleCondition = {
  field: string;
  op: ConditionOperator;
  value?: string | number | boolean | string[];
};

export type ConditionGroup = {
  operator: "and" | "or";
  conditions: SingleCondition[];
};

export type LegacyVisibleWhen = Record<string, string | string[]>;

export type VisibleWhen = ConditionGroup | LegacyVisibleWhen;

const readString = (value: unknown): string => {
  if (value == null) return "";
  if (typeof value === "string") return value.trim();
  if (typeof value === "number" || typeof value === "boolean") {
    return String(value).trim();
  }
  if (Array.isArray(value)) return value.map(String).join(", ");
  return "";
};

const isEmptyValue = (value: unknown): boolean =>
  value == null ||
  readString(value) === "" ||
  (Array.isArray(value) && value.length === 0);

const isConditionGroup = (
  visibleWhen: VisibleWhen | undefined,
): visibleWhen is ConditionGroup =>
  Boolean(
    visibleWhen &&
      typeof visibleWhen === "object" &&
      "conditions" in visibleWhen &&
      Array.isArray((visibleWhen as ConditionGroup).conditions),
  );

export const evaluateSingleCondition = (
  condition: SingleCondition,
  answers: Record<string, unknown>,
): boolean => {
  const value = answers[condition.field];
  const stringValue = readString(value);

  switch (condition.op) {
    case "equals":
      return stringValue === readString(condition.value);
    case "not_equals":
      return stringValue !== readString(condition.value);
    case "contains":
      if (Array.isArray(value)) {
        return value.map(String).includes(readString(condition.value));
      }
      return stringValue.includes(readString(condition.value));
    case "not_contains":
      if (Array.isArray(value)) {
        return !value.map(String).includes(readString(condition.value));
      }
      return !stringValue.includes(readString(condition.value));
    case "greater_than":
      return Number(value) > Number(condition.value);
    case "less_than":
      return Number(value) < Number(condition.value);
    case "greater_or_equal":
      return Number(value) >= Number(condition.value);
    case "less_or_equal":
      return Number(value) <= Number(condition.value);
    case "is_empty":
      return isEmptyValue(value);
    case "is_not_empty":
      return !isEmptyValue(value);
    case "in":
      return (
        Array.isArray(condition.value) &&
        condition.value.map(String).includes(stringValue)
      );
    case "not_in":
      return (
        Array.isArray(condition.value) &&
        !condition.value.map(String).includes(stringValue)
      );
    default:
      return true;
  }
};

export const evaluateCondition = (
  visibleWhen: VisibleWhen | undefined,
  answers: Record<string, unknown>,
): boolean => {
  if (!visibleWhen) return true;

  if (isConditionGroup(visibleWhen)) {
    if (visibleWhen.conditions.length === 0) return true;
    const results = visibleWhen.conditions.map((condition) =>
      evaluateSingleCondition(condition, answers),
    );
    return visibleWhen.operator === "or"
      ? results.some(Boolean)
      : results.every(Boolean);
  }

  if (
    typeof visibleWhen === "object" &&
    "field" in visibleWhen &&
    typeof (visibleWhen as { field?: unknown }).field === "string"
  ) {
    const shorthand = visibleWhen as {
      field: string;
      operator?: ConditionOperator;
      op?: ConditionOperator;
      value?: string | number | boolean | string[];
    };
    return evaluateSingleCondition(
      {
        field: shorthand.field,
        op: shorthand.operator ?? shorthand.op ?? "equals",
        value: shorthand.value,
      },
      answers,
    );
  }

  return Object.entries(visibleWhen).every(([fieldKey, expected]) => {
    const actual = readString(answers[fieldKey]);
    if (Array.isArray(expected)) {
      return expected.map(String).includes(actual);
    }
    return actual === readString(expected);
  });
};
