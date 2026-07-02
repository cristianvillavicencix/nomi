export type SplitEmailContent = {
  content: string;
  quoted: string | null;
  quoteHeader: string | null;
};

const PLAIN_QUOTE_HEADER =
  /(?:^|\n)\s*(?:On .+wrote:|El .+escribi[oó]:|Le .+écrit\s?:|Am .+schrieb:|-----Original Message-----|_{5,})/im;

const PLAIN_QUOTED_LINES = /\n>{1,}\s/m;

const GMAIL_QUOTE_HTML =
  /<div[^>]*class="[^"]*gmail_quote[^"]*"[\s\S]*/i;
const GMAIL_EXTRA_HTML =
  /<div[^>]*class="[^"]*gmail_extra[^"]*"[\s\S]*/i;
const BLOCKQUOTE_CITE_HTML =
  /<blockquote[^>]*type=["']?cite["']?[\s\S]*/i;
const OUTLOOK_REPLY_HTML = /<div[^>]*id=["']?divRplyFwdMsg["']?[\s\S]*/i;
const WROTE_HEADER_HTML =
  /<(?:div|p)[^>]*>[\s\S]*?(?:On .+wrote:|El .+escribi[oó]:)[\s\S]*/i;

const hasVisibleText = (value: string) =>
  value.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim().length > 0;

const firstLine = (value: string) => value.split(/\r?\n/)[0]?.trim() ?? null;

const QUOTE_HEADER_TEXT =
  /^(?:On .+wrote:|El .+escribi[oó]:|Le .+écrit\s?:|Am .+schrieb:|-----Original Message-----)/i;

export const stripQuoteHeaderFromPlainQuoted = (
  quoted: string,
  quoteHeader?: string | null,
) => {
  const trimmed = quoted.trim();
  if (!trimmed) return trimmed;

  const lines = trimmed.split(/\r?\n/);
  const first = lines[0]?.trim() ?? "";
  if (
    (quoteHeader && first === quoteHeader.trim()) ||
    QUOTE_HEADER_TEXT.test(first)
  ) {
    return lines.slice(1).join("\n").trim();
  }

  return trimmed;
};

export const stripQuoteHeaderFromHtmlQuoted = (
  quoted: string,
  quoteHeader?: string | null,
) => {
  let next = quoted.trim();
  if (!next) return next;

  if (quoteHeader) {
    const escaped = quoteHeader.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    next = next
      .replace(
        new RegExp(`^\\s*(?:<p[^>]*>)?\\s*${escaped}\\s*(?:</p>)?`, "i"),
        "",
      )
      .trim();
  }

  return next
    .replace(
      /^\s*<(?:div|p)[^>]*>\s*(?:On .+wrote:|El .+escribi[oó]:)[\s\S]*?<\/(?:div|p)>\s*/i,
      "",
    )
    .trim();
};

const hasSubstantialQuotedContent = (value: string) =>
  value.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim().length > 20;

export const splitPlainTextEmail = (text: string): SplitEmailContent => {
  const trimmed = text.trim();
  if (!trimmed) {
    return { content: "", quoted: null, quoteHeader: null };
  }

  const headerMatch = PLAIN_QUOTE_HEADER.exec(trimmed);
  if (headerMatch && headerMatch.index > 0) {
    const content = trimmed.slice(0, headerMatch.index).trim();
    const quoted = trimmed.slice(headerMatch.index).trim();
    if (content) {
      return {
        content,
        quoted,
        quoteHeader: firstLine(quoted),
      };
    }
  }

  const quotedLinesMatch = PLAIN_QUOTED_LINES.exec(trimmed);
  if (quotedLinesMatch && quotedLinesMatch.index > 0) {
    const content = trimmed.slice(0, quotedLinesMatch.index).trim();
    const quoted = trimmed.slice(quotedLinesMatch.index).trim();
    if (content) {
      return { content, quoted, quoteHeader: null };
    }
  }

  return { content: trimmed, quoted: null, quoteHeader: null };
};

const extractQuoteHeaderFromHtml = (quotedHtml: string) => {
  const text = quotedHtml
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/\s+/g, " ")
    .trim();
  const match = text.match(
    /(?:On .+wrote:|El .+escribi[oó]:|Le .+écrit\s?:|-----Original Message-----)/i,
  );
  return match?.[0] ?? firstLine(text);
};

export const splitHtmlEmail = (html: string): SplitEmailContent => {
  const trimmed = html.trim();
  if (!trimmed) {
    return { content: "", quoted: null, quoteHeader: null };
  }

  const patterns = [
    GMAIL_QUOTE_HTML,
    GMAIL_EXTRA_HTML,
    BLOCKQUOTE_CITE_HTML,
    OUTLOOK_REPLY_HTML,
    WROTE_HEADER_HTML,
  ];

  for (const pattern of patterns) {
    const match = pattern.exec(trimmed);
    if (match && match.index > 0) {
      const content = trimmed.slice(0, match.index).trim();
      const quoted = trimmed.slice(match.index).trim();
      if (hasVisibleText(content)) {
        return {
          content,
          quoted,
          quoteHeader: extractQuoteHeaderFromHtml(quoted),
        };
      }
    }
  }

  return { content: trimmed, quoted: null, quoteHeader: null };
};

export const stripQuotedPlainText = (text: string) =>
  splitPlainTextEmail(text).content;

export const stripQuotedHtml = (html: string) => splitHtmlEmail(html).content;

/** Removes our composer quote block from outbound HTML before persisting in CRM. */
export const stripComposerQuotedHtml = (html: string) =>
  html
    .replace(
      /<div[^>]*data-ticket-reply-quote="true"[^>]*>[\s\S]*?<\/div>/gi,
      "",
    )
    .trim();

export const stripComposerQuotedPlainText = (text: string) => {
  const split = splitPlainTextEmail(text);
  return split.quoted ? split.content : text.trim();
};

export const prepareQuotedPlainForDisplay = (
  quoted: string,
  quoteHeader?: string | null,
) => stripQuoteHeaderFromPlainQuoted(quoted, quoteHeader);

export const prepareQuotedHtmlForDisplay = (
  quoted: string,
  quoteHeader?: string | null,
) => stripQuoteHeaderFromHtmlQuoted(quoted, quoteHeader);

export { hasSubstantialQuotedContent };

const normalizePlainForCompare = (text: string) =>
  text.replace(/\s+/g, " ").trim().toLowerCase();

export const isPlainTextSimilar = (left: string, right: string) => {
  const a = normalizePlainForCompare(left);
  const b = normalizePlainForCompare(right);
  if (!a || !b) return false;
  if (a === b) return true;
  if (a.length >= 24 && b.length >= 24) {
    return a.includes(b) || b.includes(a);
  }
  return false;
};

export const hasRichHtmlStructure = (html: string) =>
  /<(table|img|style|center|font|tbody|thead|colgroup)\b/i.test(html);
