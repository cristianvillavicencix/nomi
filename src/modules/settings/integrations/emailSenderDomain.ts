export const DEFAULT_ORG_EMAIL_DOMAIN = "lbs.bz";

const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const isValidEmailAddress = (value: string) =>
  emailRegex.test(value.trim().toLowerCase());

export const isAllowedOrgEmailAddress = (
  value: string,
  allowedDomain = DEFAULT_ORG_EMAIL_DOMAIN,
) => {
  const normalized = value.trim().toLowerCase();
  const domain = allowedDomain.trim().toLowerCase();
  if (!isValidEmailAddress(normalized)) return false;
  return normalized.endsWith(`@${domain}`);
};

export const validateOrgSenderEmail = (
  value: string,
  allowedDomain = DEFAULT_ORG_EMAIL_DOMAIN,
) => {
  const trimmed = value.trim();
  if (!trimmed) {
    return "Email is required";
  }
  if (!isValidEmailAddress(trimmed)) {
    return "Enter a valid email address";
  }
  if (!isAllowedOrgEmailAddress(trimmed, allowedDomain)) {
    return `Use an @${allowedDomain} address`;
  }
  return null;
};
