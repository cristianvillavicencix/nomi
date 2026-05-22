export const extractDigits = (input: string): string =>
  (input ?? "").replace(/\D/g, "");

export const normalizeUsPhoneToE164 = (input: string): string | null => {
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

export const phonesMatch = (left: string, right: string) => {
  const a = normalizeUsPhoneToE164(left);
  const b = normalizeUsPhoneToE164(right);
  if (!a || !b) return false;
  return a === b;
};

export const contactHasPhone = (
  phoneJsonb: unknown,
  targetPhone: string,
): boolean => {
  if (!Array.isArray(phoneJsonb)) return false;
  return phoneJsonb.some((entry) => {
    if (!entry || typeof entry !== "object") return false;
    const number = (entry as { number?: string }).number;
    return typeof number === "string" && phonesMatch(number, targetPhone);
  });
};
