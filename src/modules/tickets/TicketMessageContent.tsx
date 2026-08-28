import { useMemo } from "react";
import type { FileAttachment } from "@/lib/fileAttachments";
import { TicketEmailAttachmentBar } from "@/modules/tickets/TicketEmailAttachmentBar";
import { TicketMessageBody } from "@/modules/tickets/TicketMessageBody";
import {
  extractMessageAssets,
  filterDownloadableMessageAssets,
} from "@/modules/tickets/ticketMessageAssets";
import { useTicketInlineHtml } from "@/modules/tickets/useTicketInlineHtml";
import { cn } from "@/lib/utils";

export const TicketMessageContent = ({
  body,
  htmlBody,
  attachments,
  className,
  emailVariant = "outbound",
}: {
  body?: string | null;
  htmlBody?: string | null;
  attachments?: FileAttachment[];
  className?: string;
  emailVariant?: "inbound" | "outbound";
}) => {
  const fileAttachments = Array.isArray(attachments) ? attachments : [];

  const assets = useMemo(
    () => extractMessageAssets({ fileAttachments }),
    [fileAttachments],
  );

  const { html: resolvedHtmlBody, isResolving } = useTicketInlineHtml(
    htmlBody,
    fileAttachments,
  );

  // Never paint unresolved cid: HTML (browser ERR_UNKNOWN_URL_SCHEME).
  const displayHtmlBody = isResolving
    ? null
    : (resolvedHtmlBody ??
      (htmlBody && /cid:/i.test(htmlBody) ? null : htmlBody));

  const downloadableAssets = useMemo(
    () =>
      isResolving
        ? []
        : filterDownloadableMessageAssets(
            assets,
            htmlBody,
            resolvedHtmlBody ?? htmlBody,
          ),
    [assets, htmlBody, resolvedHtmlBody, isResolving],
  );

  const attachmentSrcs = useMemo(
    () =>
      downloadableAssets
        .map((asset) => asset.href)
        .filter(Boolean),
    [downloadableAssets],
  );

  const attachmentTitles = useMemo(
    () =>
      downloadableAssets
        .map((asset) => asset.label)
        .filter(Boolean),
    [downloadableAssets],
  );

  return (
    <div className={cn(className)}>
      <TicketEmailAttachmentBar assets={downloadableAssets} />
      {isResolving && htmlBody?.trim() ? (
        <p className="py-2 text-sm text-muted-foreground">Loading message…</p>
      ) : (
        <TicketMessageBody
          body={body}
          htmlBody={displayHtmlBody}
          attachmentSrcs={attachmentSrcs}
          attachmentTitles={attachmentTitles}
          emailVariant={emailVariant}
        />
      )}
    </div>
  );
};
