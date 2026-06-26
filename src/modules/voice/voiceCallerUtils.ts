import { normalizeUsPhoneToE164, formatUsPhoneDisplayFromAny } from "@/utils/phone";

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
