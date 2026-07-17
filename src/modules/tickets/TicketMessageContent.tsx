import { useMemo } from "react";
import type { FileAttachment } from "@/lib/fileAttachments";
import { TicketMessageBody } from "@/modules/tickets/TicketMessageBody";
import { TicketMessageAttachments } from "@/modules/tickets/TicketMessageAttachments";
import {
  extractMessageAssets,
  partitionMessageAssets,
} from "@/modules/tickets/ticketMessageAssets";
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

  const { documents, videos, photos } = useMemo(
    () => partitionMessageAssets(assets),
    [assets],
  );

  const hasFileAssets =
    documents.length > 0 || videos.length > 0 || photos.length > 0;

  return (
    <div className={cn(className)}>
      <TicketMessageBody
        body={body}
        htmlBody={htmlBody}
        emailVariant={emailVariant}
      />
      {hasFileAssets ? (
        <TicketMessageAttachments
          documents={documents}
          videos={videos}
          photos={photos}
        />
      ) : null}
    </div>
  );
};
