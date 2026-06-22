const DANGEROUS_BODY_PATTERNS = [
  /<script[\s>]/i,
  /javascript:/i,
  // Word boundary avoids false positives in URLs/words (e.g. "?sections=logo").
  /\bon[a-z]+\s*=/i,
];

export const sanitizeMessageBody = (body: string) => {
  const trimmed = body.trim();
  for (const pattern of DANGEROUS_BODY_PATTERNS) {
    if (pattern.test(trimmed)) {
      throw new Error("Message contains disallowed content");
    }
  }
  return trimmed;
};

export const expandTemplateVariables = (
  template: string,
  variables: Record<string, string | null | undefined>,
) =>
  template.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_match, key: string) => {
    const value = variables[key];
    return value?.trim() ? value.trim() : `{{${key}}}`;
  });
