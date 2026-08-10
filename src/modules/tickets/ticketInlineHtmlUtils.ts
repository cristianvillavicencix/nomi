type InlineHtmlFile = {
  title?: string;
  type?: string;
  src?: string;
  path?: string;
  contentId?: string | null;
};

const IMAGE_EXT = /\.(png|jpe?g|gif|webp|bmp|svg|heic|heif)(\?|#|$)/i;

export const normalizeAttachmentReference = (value: string) => {
  const trimmed = value.trim().toLowerCase();
  if (!trimmed) return "";
  try {
    const url = new URL(trimmed, "https://local.invalid");
    return `${url.pathname}${url.search}`.replace(/^\//, "");
  } catch {
    return trimmed.replace(/^\//, "");
  }
};

export const isTicketImageAttachment = (file: InlineHtmlFile) => {
  const type = file.type?.toLowerCase() ?? "";
  const name = file.title?.toLowerCase() ?? "";
  const src = file.src?.toLowerCase() ?? "";
  const path = file.path?.toLowerCase() ?? "";
  if (type.startsWith("image/")) return true;
  return (
    IMAGE_EXT.test(name) ||
    IMAGE_EXT.test(src) ||
    IMAGE_EXT.test(path)
  );
};

export const isInlineImageCandidate = (
  file: InlineHtmlFile,
  sourceHtml?: string | null,
) => {
  if (!isTicketImageAttachment(file)) return false;
  if (file.contentId?.trim()) return true;
  const html = sourceHtml?.trim();
  if (!html) return false;
  const reference = file.path?.trim() || file.src?.trim();
  if (!reference) return false;
  return html.toLowerCase().includes(normalizeAttachmentReference(reference));
};

export const isInlineImageRenderedInHtml = (
  file: InlineHtmlFile,
  html?: string | null,
  signedUrl?: string | null,
) => {
  const haystack = html?.trim().toLowerCase();
  if (!haystack || !/<img\b/i.test(haystack)) return false;

  const references = [signedUrl, file.src, file.path]
    .filter(Boolean)
    .map((value) => String(value).toLowerCase());

  return references.some((reference) => {
    if (
      reference.startsWith("http") ||
      reference.startsWith("blob:") ||
      reference.startsWith("data:")
    ) {
      return haystack.includes(reference);
    }
    const normalized = normalizeAttachmentReference(reference);
    return normalized ? haystack.includes(normalized) : false;
  });
};
