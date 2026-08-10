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

  const downloadableAssets = useMemo(
    () => filterDownloadableMessageAssets(assets, htmlBody),
    [assets, htmlBody],
  );

  const resolvedHtmlBody = useTicketInlineHtml(htmlBody, fileAttachments);

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
      <TicketMessageBody
        body={body}
        htmlBody={resolvedHtmlBody ?? htmlBody}
        attachmentSrcs={attachmentSrcs}
        attachmentTitles={attachmentTitles}
        emailVariant={emailVariant}
      />
    </div>
  );
};
