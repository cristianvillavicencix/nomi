import { useEffect, useMemo, useState } from "react";
import type { FileAttachment } from "@/lib/fileAttachments";
import { resolveTicketDisplayHtml } from "@/modules/tickets/ticketInlineHtml";
import { isInlineImageCandidate } from "@/modules/tickets/ticketInlineHtmlUtils";

const resolveCache = new Map<string, string | null>();

const buildCacheKey = (
  html: string | null | undefined,
  attachments: FileAttachment[],
) => {
  const attachmentKey = attachments
    .map((file) =>
      [file.src, file.path, file.contentId, file.title].filter(Boolean).join("|"),
    )
    .join("\n");
  return `${html ?? ""}\0${attachmentKey}`;
};

export const needsAsyncTicketHtmlResolution = (
  html: string | null | undefined,
  attachments: FileAttachment[],
) => {
  const trimmed = html?.trim();
  if (!trimmed && attachments.length === 0) return false;
  if (/cid:/i.test(trimmed ?? "")) return true;
  if (attachments.some((file) => isInlineImageCandidate(file, trimmed))) {
    return true;
  }
  for (const file of attachments) {
    const reference = file.path?.trim() || file.src?.trim();
    if (!reference || reference.startsWith("http")) continue;
    if (trimmed?.includes(reference)) return true;
  }
  return false;
};

export type TicketInlineHtmlResult = {
  html: string | null;
  isResolving: boolean;
};

export const useTicketInlineHtml = (
  html: string | null | undefined,
  attachments: FileAttachment[],
): TicketInlineHtmlResult => {
  const cacheKey = useMemo(
    () => buildCacheKey(html, attachments),
    [html, attachments],
  );

  const needsResolution = useMemo(
    () => needsAsyncTicketHtmlResolution(html, attachments),
    [html, attachments],
  );

  const cached = resolveCache.get(cacheKey);
  const [resolved, setResolved] = useState<string | null>(() => {
    if (needsResolution) return cached ?? null;
    return html?.trim() || null;
  });
  const [isResolving, setIsResolving] = useState(
    () => needsResolution && cached === undefined,
  );

  useEffect(() => {
    if (!needsResolution) {
      setResolved(html?.trim() || null);
      setIsResolving(false);
      return;
    }

    if (resolveCache.has(cacheKey)) {
      setResolved(resolveCache.get(cacheKey) ?? null);
      setIsResolving(false);
      return;
    }

    let cancelled = false;
    setIsResolving(true);

    void resolveTicketDisplayHtml(html, attachments).then((next) => {
      resolveCache.set(cacheKey, next);
      if (!cancelled) {
        setResolved(next);
        setIsResolving(false);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [cacheKey, html, attachments, needsResolution]);

  return { html: resolved, isResolving };
};
