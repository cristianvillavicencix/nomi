export type SkippedAttachmentLine = {
  title: string;
  sizeLabel: string;
  reason: string;
};

export type SkippedAttachmentsNote = {
  count: number;
  lines: SkippedAttachmentLine[];
  /** Clean body/html without the skipped-attachments appendix. */
  contentWithoutNote: string;
};

const SKIPPED_HEADER_RE =
  /(?:^|\n)\s*(?:---\s*\n+)?Skipped attachments:\s*\n/i;

const SKIPPED_LINE_RE =
  /^[-*•]\s*(.+?)\s*\(([^,)]+),\s*([^)]+)\)\s*$/;

const toPlain = (value: string) =>
  value
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n")
    .replace(/<[^>]+>/g, "");

const findSkippedHeaderIndex = (plain: string) => {
  const match = SKIPPED_HEADER_RE.exec(plain);
  if (!match || match.index == null) return -1;
  return match.index;
};

const parseLinesAfterHeader = (plain: string, headerIndex: number) => {
  const headerMatch = SKIPPED_HEADER_RE.exec(plain.slice(headerIndex));
  if (!headerMatch) return [];
  const afterHeader = plain.slice(headerIndex + headerMatch[0].length);
  const lines: SkippedAttachmentLine[] = [];
  for (const row of afterHeader.split("\n")) {
    const trimmed = row.trim();
    if (!trimmed) {
      if (lines.length) break;
      continue;
    }
    const lineMatch = SKIPPED_LINE_RE.exec(trimmed);
    if (!lineMatch) {
      if (lines.length) break;
      continue;
    }
    lines.push({
      title: lineMatch[1].trim(),
      sizeLabel: lineMatch[2].trim(),
      reason: lineMatch[3].trim(),
    });
  }
  return lines;
};

/**
 * Parse the inbound "Skipped attachments:" appendix that Postmark/SendGrid
 * append to ticket message bodies when uploads hit count/size limits.
 */
export const parseSkippedAttachmentsNote = (
  source?: string | null,
): SkippedAttachmentsNote | null => {
  const raw = source?.trim();
  if (!raw) return null;

  const plain = toPlain(raw);
  const headerIndex = findSkippedHeaderIndex(plain);
  if (headerIndex < 0) return null;

  const lines = parseLinesAfterHeader(plain, headerIndex);
  if (!lines.length) return null;

  return {
    count: lines.length,
    lines,
    contentWithoutNote: plain.slice(0, headerIndex).trimEnd(),
  };
};

/** Strip skipped-attachments appendix from plain or lightly-HTML body. */
export const stripSkippedAttachmentsNote = (
  source?: string | null,
): string => {
  const raw = source?.trim();
  if (!raw) return "";

  const parsed = parseSkippedAttachmentsNote(raw);
  if (!parsed) return raw;

  if (!/<\w/i.test(raw)) {
    return parsed.contentWithoutNote;
  }

  // HTML path: rebuild from plain content (keeps simple bodies readable).
  // Prefer cutting at the first "Skipped attachments" marker in the original.
  const marker = /(?:<br\s*\/?>|\n|\r)*\s*(?:-{3,}\s*(?:<br\s*\/?>|\n|\r)*)?\s*Skipped attachments\s*:/i;
  const cut = marker.exec(raw);
  if (cut && cut.index != null) {
    return raw.slice(0, cut.index).replace(/(?:<br\s*\/?>|\s)+$/gi, "").trim();
  }

  return parsed.contentWithoutNote;
};
