import { useEffect, useMemo, useState } from "react";
import type { FileAttachment } from "@/lib/fileAttachments";
import { resolveTicketDisplayHtml } from "@/modules/tickets/ticketInlineHtml";
import { isInlineImageCandidate } from "@/modules/tickets/ticketInlineHtmlUtils";

const resolveCache = new Map<string, string | null>();

const buildAttachmentsKey = (attachments: FileAttachment[]) =>
  attachments
    .map((file) =>
      [file.src, file.path, file.contentId, file.title].filter(Boolean).join("|"),
    )
    .join("\n");

const buildCacheKey = (
  html: string | null | undefined,
  attachmentsKey: string,
) => `${html ?? ""}\0${attachmentsKey}`;

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
  const attachmentsKey = useMemo(
    () => buildAttachmentsKey(attachments),
    [attachments],
  );

  const cacheKey = useMemo(
    () => buildCacheKey(html, attachmentsKey),
    [html, attachmentsKey],
  );

  const needsResolution = useMemo(
    () => needsAsyncTicketHtmlResolution(html, attachments),
    [html, attachmentsKey],
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
      const cachedHtml = resolveCache.get(cacheKey) ?? null;
      setResolved((current) => (current === cachedHtml ? current : cachedHtml));
      setIsResolving((current) => (current ? false : current));
      return;
    }

    let cancelled = false;
    setIsResolving((current) => (current ? current : true));

    void resolveTicketDisplayHtml(html, attachments).then((next) => {
      resolveCache.set(cacheKey, next);
      if (!cancelled) {
        setResolved((current) => (current === next ? current : next));
        setIsResolving((current) => (current ? false : current));
      }
    });

    return () => {
      cancelled = true;
    };
  }, [cacheKey, html, attachmentsKey, needsResolution]);

  return { html: resolved, isResolving };
};
