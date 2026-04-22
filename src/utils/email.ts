const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const COMMON_EMAIL_DOMAINS = [
  "gmail.com",
  "hotmail.com",
  "outlook.com",
  "yahoo.com",
  "icloud.com",
  "live.com",
  "aol.com",
  "proton.me",
  "protonmail.com",
];

export const isValidEmail = (email: string): boolean =>
  EMAIL_REGEX.test((email ?? "").trim());

export const getEmailDomainSuggestions = (value: string): string[] => {
  const trimmed = (value ?? "").trim().toLowerCase();
  const atIndex = trimmed.indexOf("@");

  if (atIndex <= 0) {
    return [];
  }

  const domainPart = trimmed.slice(atIndex + 1);
  if (isValidEmail(trimmed)) {
    return [];
  }

  return COMMON_EMAIL_DOMAINS.filter((domain) =>
    domain.startsWith(domainPart),
  );
};
