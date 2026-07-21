import type { MailMessage } from "./types";

/** RFC Message-ID from synced headers (for In-Reply-To when sending). */
export function mailRfcMessageId(message: MailMessage | undefined): string | undefined {
  if (!message) return undefined;
  const headers = message.raw_headers;
  if (headers && typeof headers === "object" && !Array.isArray(headers)) {
    const id = (headers as Record<string, unknown>)["Message-ID"];
    if (typeof id === "string" && id.trim()) return id.trim();
  }
  if (message.in_reply_to?.trim()) return message.in_reply_to.trim();
  return undefined;
}
