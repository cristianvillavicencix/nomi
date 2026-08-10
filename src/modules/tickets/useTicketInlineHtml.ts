import { useEffect, useState } from "react";
import type { FileAttachment } from "@/lib/fileAttachments";
import { resolveTicketInlineHtml } from "@/modules/tickets/ticketInlineHtml";

export const useTicketInlineHtml = (
  html: string | null | undefined,
  attachments: FileAttachment[],
): string | null => {
  const [resolved, setResolved] = useState<string | null>(html?.trim() || null);
  const attachmentsKey = attachments
    .map((file) =>
      [file.src, file.path, file.contentId, file.title].filter(Boolean).join("|"),
    )
    .join("\n");

  useEffect(() => {
    const trimmed = html?.trim();
    if (!trimmed) {
      setResolved(null);
      return;
    }

    let cancelled = false;

    void resolveTicketInlineHtml(trimmed, attachments).then((next) => {
      if (!cancelled) setResolved(next);
    });

    return () => {
      cancelled = true;
    };
  }, [html, attachmentsKey]);

  return resolved;
};
