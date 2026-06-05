const isNonEmptyString = (value: unknown) =>
  typeof value === "string" && value.trim().length > 0;

const isNonEmptyNumber = (value: unknown) =>
  typeof value === "number" && Number.isFinite(value) && value !== 0;

/** True when the user has entered something worth keeping as a draft. */
export const hasMeaningfulFormContent = (value: unknown): boolean => {
  if (value == null) return false;
  if (isNonEmptyString(value) || isNonEmptyNumber(value)) return true;
  if (typeof value === "boolean") return value;

  if (Array.isArray(value)) {
    return value.some((item) => hasMeaningfulFormContent(item));
  }

  if (typeof value === "object") {
    return Object.values(value as Record<string, unknown>).some((item) =>
      hasMeaningfulFormContent(item),
    );
  }

  return false;
};
