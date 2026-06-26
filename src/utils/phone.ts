const DASH = "—";

export const extractDigits = (input: string): string =>
  (input ?? "").replace(/\D/g, "");

export const normalizeUsPhoneToE164 = (input: string): string | null => {
  // Ignore extensions like "Ext 2", "x123", or "extension 45".
  const withoutExtension = (input ?? "").replace(
    /(?:\s|,|;)*(?:ext(?:ension)?\.?|x)\s*\d+\s*$/i,
    "",
  );
  const digits = extractDigits(withoutExtension);

  if (digits.length === 10) {
    return `+1${digits}`;
  }

  if (digits.length === 11 && digits.startsWith("1")) {
    return `+${digits}`;
  }

  return null;
};

export const isValidUsPhone = (input: string): boolean =>
  normalizeUsPhoneToE164(input) != null;

export const formatUsPhoneDisplayFromAny = (input: string): string => {
  const normalized = normalizeUsPhoneToE164(input);
  if (!normalized) {
    return DASH;
  }

  const digits = extractDigits(normalized).slice(-10);
  const area = digits.slice(0, 3);
  const prefix = digits.slice(3, 6);
  const line = digits.slice(6, 10);

  return `(${area}) ${prefix}-${line}`;
};

/** Formatted US display or em dash when the value is not a 10-digit number. */
export const formatPhoneDisplay = (
  input: string | null | undefined,
): string => {
  if (!input?.trim() || input.trim() === DASH) {
    return DASH;
  }
  return formatUsPhoneDisplayFromAny(input);
};

export const getPhoneE164 = (input: string): string | null =>
  normalizeUsPhoneToE164(input);
