import {
  formatUsPhoneDisplayFromAny,
  normalizeUsPhoneToE164,
} from "@/utils/phone";
import { isValidEmail } from "@/utils/email";

export const normalizePhoneForTel = (input: string) => {
  const normalized = normalizeUsPhoneToE164(input);

  if (!normalized) {
    return {
      display: input || "—",
      telHref: "",
    };
  }

  return {
    display: formatUsPhoneDisplayFromAny(normalized),
    telHref: `tel:${normalized}`,
  };
};

export const mailtoHref = (email: string): string => {
  const trimmed = (email ?? "").trim();
  if (!isValidEmail(trimmed)) {
    return "";
  }

  return `mailto:${trimmed.toLowerCase()}`;
};

export const mapsHref = (address: string): string =>
  `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address ?? "")}`;
