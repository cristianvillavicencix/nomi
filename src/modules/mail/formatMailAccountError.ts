const MAX_ERROR_LENGTH = 240;

/** Strip HTML worker pages and truncate for Settings / Mail UI. */
export function formatMailAccountError(raw: string | null | undefined): string {
  if (!raw?.trim()) return "";
  const trimmed = raw.trim();

  if (
    trimmed.startsWith("<!DOCTYPE") ||
    trimmed.startsWith("<html") ||
    /Error code 522/i.test(trimmed) ||
    /onrender\.com/i.test(trimmed)
  ) {
    return "IMAP worker unreachable (timeout). Check MAIL_IMAP_WORKER_URL.";
  }

  const stripped = trimmed
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  if (stripped.length <= MAX_ERROR_LENGTH) return stripped;
  return `${stripped.slice(0, MAX_ERROR_LENGTH - 1)}…`;
}
