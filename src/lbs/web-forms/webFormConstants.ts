export const SYSTEM_WEB_FORM_SLUGS = [
  "website-intake",
  "project-resources",
] as const;

export type SystemWebFormSlug = (typeof SYSTEM_WEB_FORM_SLUGS)[number];

export const isSystemWebFormSlug = (slug: string): slug is SystemWebFormSlug =>
  (SYSTEM_WEB_FORM_SLUGS as readonly string[]).includes(slug);

export const normalizeWebFormSlug = (value: string) =>
  value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

export const validateWebFormSlug = (value?: string) => {
  if (!value?.trim()) return "Required";

  const slug = normalizeWebFormSlug(value);
  if (!slug) return "Required";
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) {
    return "Use lowercase letters, numbers, and hyphens";
  }
  if (isSystemWebFormSlug(slug)) {
    return "This slug is reserved for a system form";
  }

  return undefined;
};
