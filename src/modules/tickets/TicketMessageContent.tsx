import { useMemo } from "react";
import type { FileAttachment } from "@/lib/fileAttachments";
import { TicketMessageBody } from "@/modules/tickets/TicketMessageBody";
import { TicketMessageAttachments } from "@/modules/tickets/TicketMessageAttachments";
import {
  collectStripHrefs,
  extractMessageAssets,
  partitionMessageAssets,
} from "@/modules/tickets/ticketMessageAssets";
import { cn } from "@/lib/utils";

export const TicketMessageContent = ({
  body,
  htmlBody,
  attachments,
  className,
}: {
  body?: string | null;
  htmlBody?: string | null;
  attachments?: FileAttachment[];
  className?: string;
}) => {
  const fileAttachments = Array.isArray(attachments) ? attachments : [];

  const assets = useMemo(
    () =>
      extractMessageAssets({
        htmlBody,
        plainBody: body,
        fileAttachments,
      }),
    [htmlBody, body, fileAttachments],
  );

  const { documents, videos, photos } = useMemo(
    () => partitionMessageAssets(assets),
    [assets],
  );

  const stripHrefs = useMemo(() => collectStripHrefs(assets), [assets]);
  const attachmentTitles = useMemo(
    () =>
      fileAttachments
        .map((file) => file.title?.trim())
        .filter((title): title is string => Boolean(title)),
    [fileAttachments],
  );

  return (
    <div className={cn(className)}>
      <TicketMessageBody
        body={body}
        htmlBody={htmlBody}
        stripHrefs={stripHrefs}
        attachmentTitles={attachmentTitles}
      />
      <TicketMessageAttachments
        documents={documents}
        videos={videos}
        photos={photos}
      />
    </div>
  );
};
