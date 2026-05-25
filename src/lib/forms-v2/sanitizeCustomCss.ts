const BLOCKED_PATTERNS = [
  /@import/gi,
  /javascript:/gi,
  /expression\s*\(/gi,
  /behavior\s*:/gi,
  /binding\s*:/gi,
  /-moz-binding/gi,
  /<\/?style/gi,
  /<\/?script/gi,
];

export const sanitizeCustomCss = (css: string | null | undefined): string => {
  if (!css?.trim()) return "";

  let sanitized = css.trim().slice(0, 8000);
  for (const pattern of BLOCKED_PATTERNS) {
    sanitized = sanitized.replace(pattern, "");
  }
  return sanitized;
};
