const MAX_ERROR_LENGTH = 500;

function truncate(message: string): string {
  const trimmed = message.trim();
  if (trimmed.length <= MAX_ERROR_LENGTH) return trimmed;
  return `${trimmed.slice(0, MAX_ERROR_LENGTH - 1)}…`;
}

/** Turn raw worker HTTP bodies into short, UI-safe error strings. */
export function formatWorkerError(raw: string, status?: number): string {
  const trimmed = raw.trim();
  if (!trimmed) {
    if (status === 522 || status === 504 || status === 503) {
      return "IMAP worker unreachable (timeout). Check MAIL_IMAP_WORKER_URL.";
    }
    return "IMAP worker request failed";
  }

  if (
    trimmed.startsWith("<!DOCTYPE") ||
    trimmed.startsWith("<html") ||
    /Error code 522/i.test(trimmed) ||
    /onrender\.com/i.test(trimmed) ||
    /cloudflare/i.test(trimmed)
  ) {
    return "IMAP worker unreachable (timeout). Check MAIL_IMAP_WORKER_URL.";
  }

  try {
    const parsed = JSON.parse(trimmed) as { error?: string };
    if (parsed.error) return truncate(parsed.error);
  } catch {
    /* not JSON */
  }

  const stripped = trimmed
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return truncate(stripped || "IMAP worker request failed");
}

export async function readWorkerErrorResponse(res: Response): Promise<string> {
  const text = await res.text();
  return formatWorkerError(text, res.status);
}

/** Auth failures need a human reconnect; timeouts must not disable cron sync. */
export function isPermanentMailAuthError(message: string): boolean {
  return /invalid_grant|invalid[_ ]credentials|authentication failed|unauthorized|access denied|token.*(revoked|expired|invalid)|needs.?reconnect|login failed|auth(entication)? (error|fail)/i.test(
    message,
  );
}
