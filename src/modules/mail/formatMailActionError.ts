/** User-facing copy for mail_actions / Graph failures. */
export function formatMailActionError(error: unknown): string {
  const message =
    error instanceof Error ? error.message : String(error ?? "Action failed");
  const lower = message.toLowerCase();

  if (
    lower.includes("applicationthrottled") ||
    lower.includes("mailboxconcurrency") ||
    lower.includes("too many requests")
  ) {
    return "Mailbox is busy (Outlook rate limit). Wait a moment and try again.";
  }

  return message || "Action failed";
}

export function isMailThrottleError(error: unknown): boolean {
  const message =
    error instanceof Error ? error.message : String(error ?? "");
  const lower = message.toLowerCase();
  return (
    lower.includes("applicationthrottled") ||
    lower.includes("mailboxconcurrency") ||
    lower.includes("too many requests") ||
    lower.includes("throttl")
  );
}
