import { stripTrailingDuplicateOfQuoted } from "@/modules/tickets/dedupeQuotedEmailDisplay";
import {
  hasSubstantialQuotedContent,
  isForwardedStyleEmail,
  splitHtmlEmail,
} from "@/modules/tickets/ticketEmailQuotedContent";

export type TicketHtmlDisplay =
  | { mode: "full"; html: string }
  | {
      mode: "split";
      content: string;
      quoted: string;
      quoteHeader: string | null;
    };

/** Explicit forward markers — not gmail_quote (also used on short replies). */
const EXPLICIT_FORWARD_MARKER =
  /Begin forwarded message:|[-]{5,}\s*Forwarded message/i;

/**
 * Decide whether ticket HTML should show the full body or collapse quoted
 * history (Gmail-style). Explicit forwards with a thin main stay full so a
 * logo-only intro does not hide the real content behind ···. Short replies
 * that only wrap history in gmail_quote still collapse.
 */
export const resolveTicketHtmlDisplay = (html: string): TicketHtmlDisplay => {
  const trimmed = html.trim();
  if (!trimmed) return { mode: "full", html: "" };

  if (
    isForwardedStyleEmail(trimmed) &&
    EXPLICIT_FORWARD_MARKER.test(trimmed)
  ) {
    return { mode: "full", html: trimmed };
  }

  const split = splitHtmlEmail(trimmed);
  if (split.quoted && hasSubstantialQuotedContent(split.quoted)) {
    return {
      mode: "split",
      content: stripTrailingDuplicateOfQuoted(
        split.content || trimmed,
        split.quoted,
        true,
      ),
      quoted: split.quoted,
      quoteHeader: split.quoteHeader,
    };
  }

  return { mode: "full", html: trimmed };
};
