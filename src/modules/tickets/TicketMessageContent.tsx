import { useMemo } from "react";
import type { FileAttachment } from "@/lib/fileAttachments";
import { TicketEmailAttachmentBar } from "@/modules/tickets/TicketEmailAttachmentBar";
import { TicketMessageAttachments } from "@/modules/tickets/TicketMessageAttachments";
import { TicketMessageBody } from "@/modules/tickets/TicketMessageBody";
import { SkippedAttachmentsNotice } from "@/modules/tickets/SkippedAttachmentsNotice";
import {
  parseSkippedAttachmentsNote,
  stripSkippedAttachmentsNote,
} from "@/modules/tickets/parseSkippedAttachmentsNote";
import {
  extractMessageAssets,
  filterDownloadableMessageAssets,
  partitionMessageAssets,
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

  const skippedNote = useMemo(
    () => parseSkippedAttachmentsNote(body) ?? parseSkippedAttachmentsNote(htmlBody),
    [body, htmlBody],
  );

  const cleanBody = useMemo(
    () => (body ? stripSkippedAttachmentsNote(body) : body),
    [body],
  );
  const cleanHtmlBody = useMemo(
    () => (htmlBody ? stripSkippedAttachmentsNote(htmlBody) : htmlBody),
    [htmlBody],
  );

  const assets = useMemo(
    () => extractMessageAssets({ fileAttachments }),
    [fileAttachments],
  );

  const { html: resolvedHtmlBody, isResolving } = useTicketInlineHtml(
    cleanHtmlBody,
    fileAttachments,
  );

  // Never paint unresolved cid: HTML (browser ERR_UNKNOWN_URL_SCHEME).
  const displayHtmlBody = isResolving
    ? null
    : (resolvedHtmlBody ??
      (cleanHtmlBody && /cid:/i.test(cleanHtmlBody) ? null : cleanHtmlBody));

  const downloadableAssets = useMemo(
    () =>
      isResolving
        ? []
        : filterDownloadableMessageAssets(
            assets,
            cleanHtmlBody,
            resolvedHtmlBody ?? cleanHtmlBody,
          ),
    [assets, cleanHtmlBody, resolvedHtmlBody, isResolving],
  );

  const { documents, videos, photos } = useMemo(
    () => partitionMessageAssets(downloadableAssets),
    [downloadableAssets],
  );

  const attachmentSrcs = useMemo(
    () => downloadableAssets.map((asset) => asset.href).filter(Boolean),
    [downloadableAssets],
  );

  const attachmentTitles = useMemo(
    () => downloadableAssets.map((asset) => asset.label).filter(Boolean),
    [downloadableAssets],
  );

  const fileBarAssets = useMemo(
    () => [...documents, ...videos],
    [documents, videos],
  );

  return (
    <div className={cn(className)}>
      <TicketEmailAttachmentBar assets={fileBarAssets} />
      {isResolving && cleanHtmlBody?.trim() ? (
        <p className="py-2 text-sm text-muted-foreground">Loading message…</p>
      ) : (
        <TicketMessageBody
          body={cleanBody}
          htmlBody={displayHtmlBody}
          attachmentSrcs={attachmentSrcs}
          attachmentTitles={attachmentTitles}
          emailVariant={emailVariant}
        />
      )}
      {photos.length > 0 ? (
        <TicketMessageAttachments
          documents={[]}
          videos={[]}
          photos={photos}
          className="mt-3 border-t border-border/60 pt-3"
          showSectionDownloadAll={photos.length > 1}
        />
      ) : null}
      {skippedNote ? <SkippedAttachmentsNotice note={skippedNote} /> : null}
    </div>
  );
};
