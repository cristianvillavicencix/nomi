const DASH = "—";

export const extractDigits = (input: string): string =>
  (input ?? "").replace(/\D/g, "");

export const normalizeUsPhoneToE164 = (input: string): string | null => {
  const digits = extractDigits(input);

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

export const getPhoneHref = (input: string): string | null => {
  const normalized = normalizeUsPhoneToE164(input);
  return normalized ? `tel:${normalized}` : null;
};

