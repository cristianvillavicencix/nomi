import {
  extractDigits,
  normalizeUsPhoneToE164,
  formatUsPhoneDisplayFromAny,
} from "@/utils/phone";

const isClientIdentity = (value: string) => value.startsWith("client:");

/** PSTN caller for an inbound browser ring (Twilio sets From = external caller). */
export const resolveIncomingCallerPhone = (
  params: Record<string, string | undefined>,
): string | null => {
  const candidates = [
    params.From,
    params.from,
    params.Caller,
    params.caller,
    params.phone,
  ];
  for (const raw of candidates) {
    const trimmed = raw?.trim();
    if (!trimmed || isClientIdentity(trimmed)) continue;
    return normalizeUsPhoneToE164(trimmed) ?? trimmed;
  }
  return null;
};

export const formatCallerPhoneLabel = (
  params: Record<string, string | undefined>,
): string => {
  const phone = resolveIncomingCallerPhone(params);
  if (phone) return formatUsPhoneDisplayFromAny(phone);
  const raw = params.From?.trim() || params.Caller?.trim();
  if (raw && !isClientIdentity(raw)) return formatUsPhoneDisplayFromAny(raw);
  return "Unknown number";
};

/**
 * True when a conversation title is just the phone (E.164 or display), not a
 * human label like an SMS thread name.
 */
export const isPhoneOnlyConversationTitle = (
  title: string | null | undefined,
  phoneE164: string | null | undefined,
  displayPhone?: string | null,
): boolean => {
  const trimmed = title?.trim() ?? "";
  if (!trimmed) return true;

  const titleDigits = extractDigits(trimmed);
  const phoneDigits = phoneE164 ? extractDigits(phoneE164) : "";
  if (
    titleDigits &&
    phoneDigits &&
    (titleDigits === phoneDigits || titleDigits === phoneDigits.slice(-10))
  ) {
    return true;
  }

  if (displayPhone && trimmed === displayPhone.trim()) return true;
  if (phoneE164 && trimmed === phoneE164.trim()) return true;

  return false;
};

/** Prefer a Messages thread title over a raw phone when it looks like a name. */
export const resolveSmsThreadDisplayName = (
  title: string | null | undefined,
  phoneE164: string | null | undefined,
  displayPhone?: string | null,
): string | null => {
  const trimmed = title?.trim() ?? "";
  if (!trimmed) return null;
  if (isPhoneOnlyConversationTitle(trimmed, phoneE164, displayPhone)) {
    return null;
  }
  return trimmed;
};
