export const normalizeFlexibleUrl = (value: string): string => {
  const raw = value.trim();
  if (!raw) return "";
  if (/^https?:\/\//i.test(raw)) return raw;
  if (raw.startsWith("//")) return `https:${raw}`;
  return `https://${raw.replace(/^\/+/, "")}`;
};

export const isFlexibleUrl = (value: string): boolean => {
  const raw = value.trim();
  if (!raw) return true;
  try {
    new URL(normalizeFlexibleUrl(raw));
    return true;
  } catch {
    return /^[\w.-]+\.[a-z]{2,}(\/.*)?$/i.test(raw);
  }
};
