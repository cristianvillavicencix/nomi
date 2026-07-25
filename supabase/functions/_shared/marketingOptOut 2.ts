const STOP_KEYWORDS = new Set([
  "STOP",
  "STOPALL",
  "UNSUBSCRIBE",
  "CANCEL",
  "END",
  "QUIT",
]);

export const SMS_OPT_OUT_CONFIRMATION =
  "You have been unsubscribed from marketing messages. Reply HELP for help.";

export function isSmsOptOutMessage(body: string): boolean {
  const trimmed = body.trim();
  if (!trimmed) return false;
  const upper = trimmed.toUpperCase();
  if (STOP_KEYWORDS.has(upper)) return true;
  const lettersOnly = upper.replace(/[^A-Z]/g, "");
  return STOP_KEYWORDS.has(lettersOnly);
}

export function appendSmsStopFooter(body: string): string {
  const trimmed = body.trim();
  const footer = "Reply STOP to opt out.";
  if (/reply\s+stop/i.test(trimmed)) return trimmed;
  return `${trimmed}\n\n${footer}`;
}
