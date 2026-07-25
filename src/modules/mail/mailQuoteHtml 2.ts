import DOMPurify from "dompurify";
import { sanitizeMailHtml } from "./sanitizeMailHtml";
import type { MailMessage } from "./types";

const MAX_QUOTE_FONT_PX = 18;

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function messageQuoteSource(
  last: MailMessage | undefined,
  snippet: string | null | undefined,
): string {
  if (last?.body_html?.trim()) return last.body_html;
  if (last?.body_text?.trim()) {
    return `<p>${escapeHtml(last.body_text).replace(/\n/g, "<br/>")}</p>`;
  }
  if (snippet?.trim()) {
    return `<p>${escapeHtml(snippet)}</p>`;
  }
  return "";
}

function flattenQuoteLayout(html: string): string {
  if (typeof document === "undefined") return html;
  const root = document.createElement("div");
  root.innerHTML = html;

  root.querySelectorAll("style, link, meta, base").forEach((el) => el.remove());

  root.querySelectorAll("*").forEach((node) => {
    const el = node as HTMLElement;
    const pos = el.style.position?.toLowerCase();
    if (pos === "fixed" || pos === "absolute" || pos === "sticky") {
      el.style.position = "static";
    }
    el.style.maxWidth = "100%";
    el.style.boxSizing = "border-box";
    if (el.tagName === "TABLE") {
      el.removeAttribute("width");
      el.style.width = "100%";
    }
    if (el.tagName === "IMG") {
      el.style.height = "auto";
    }
  });

  root.querySelectorAll("[style]").forEach((node) => {
    const el = node as HTMLElement;
    let style = el.getAttribute("style") ?? "";
    style = style.replace(
      /font-size\s*:\s*([\d.]+)\s*(px|pt|em|rem)/gi,
      (match, num, unit) => {
        const value = Number(num);
        if (!Number.isFinite(value)) return match;
        let px = value;
        if (String(unit).toLowerCase() === "pt") px = value * 1.33;
        if (String(unit).toLowerCase() === "em" || String(unit).toLowerCase() === "rem") {
          px = value * 16;
        }
        if (px > MAX_QUOTE_FONT_PX) return "font-size:13px";
        return match;
      },
    );
    style = style.replace(/width\s*:\s*[\d.]+\s*px/gi, "max-width:100%");
    style = style.replace(/min-width\s*:\s*[\d.]+\s*px/gi, "min-width:0");
    el.setAttribute("style", style);
  });

  return root.innerHTML;
}

/** Sanitized HTML safe to show in compose quote pane and to append when sending. */
export function prepareQuotedHtmlForCompose(raw: string): string {
  if (!raw.trim()) return "<p></p>";
  const stripped = raw.replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, "");
  const sanitized = sanitizeMailHtml(stripped);
  const noStyle = DOMPurify.sanitize(sanitized, {
    FORBID_TAGS: ["style", "link", "meta", "iframe", "object", "embed", "form"],
  });
  return flattenQuoteLayout(noStyle);
}

export function buildReplyQuoteBlock(
  last: MailMessage | undefined,
  snippet: string | null,
): string {
  const quoted = prepareQuotedHtmlForCompose(messageQuoteSource(last, snippet));
  const from = escapeHtml(
    last?.from_name?.trim() || last?.from_email?.trim() || "Unknown",
  );
  const when = last?.sent_at
    ? escapeHtml(new Date(last.sent_at).toLocaleString())
    : "";
  const header = when
    ? `On ${when}, ${from} wrote:`
    : `${from} wrote:`;
  return `<p>${header}</p><blockquote class="mail-compose-quote">${quoted || "<p></p>"}</blockquote>`;
}

export function buildForwardQuoteBlock(
  last: MailMessage | undefined,
  snippet: string | null,
): string {
  const quoted = prepareQuotedHtmlForCompose(messageQuoteSource(last, snippet));
  return `<p>---------- Forwarded message ----------</p><blockquote class="mail-compose-quote">${quoted || "<p></p>"}</blockquote>`;
}

/** @deprecated use buildReplyQuoteBlock + separate user editor */
export function buildReplyQuoteHtml(
  last: MailMessage | undefined,
  snippet: string | null,
): string {
  return `<p><br></p>${buildReplyQuoteBlock(last, snippet)}`;
}

/** @deprecated use buildForwardQuoteBlock + separate user editor */
export function buildForwardQuoteHtml(
  last: MailMessage | undefined,
  snippet: string | null,
): string {
  return `<p><br></p>${buildForwardQuoteBlock(last, snippet)}`;
}

export function assembleComposeBody(
  userHtml: string,
  quotedHtml: string | null | undefined,
): string {
  const top = userHtml.trim() || "<p></p>";
  if (!quotedHtml?.trim()) return top;
  return `${top}${quotedHtml}`;
}
