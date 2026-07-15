import { useMemo } from "react";
import { Paperclip } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import type { FileAttachment } from "@/lib/fileAttachments";
import type { Ticket } from "@/modules/types";
import { TicketMessageAttachments } from "@/modules/tickets/TicketMessageAttachments";
import {
  extractMessageAssets,
  partitionMessageAssets,
  type MessageAsset,
} from "@/modules/tickets/ticketMessageAssets";
import { useTicketThreadMessages } from "@/modules/tickets/useTicketThreadMessages";

const collectThreadAssets = (
  messages: Array<{
    attachments?: unknown[] | null;
    html_body?: string | null;
    body?: string | null;
  }>,
): MessageAsset[] => {
  const assets: MessageAsset[] = [];
  for (const message of messages) {
    const fileAttachments = Array.isArray(message.attachments)
      ? (message.attachments as FileAttachment[])
      : [];
    assets.push(
      ...extractMessageAssets({
        htmlBody: message.html_body,
        plainBody: message.body,
        fileAttachments,
      }),
    );
  }
  return assets;
};

export const TicketFilesSidePanel = ({ ticket }: { ticket: Ticket }) => {
  const { messages, isPending } = useTicketThreadMessages(ticket.id);

  const { documents, videos, photos } = useMemo(
    () => partitionMessageAssets(collectThreadAssets(messages)),
    [messages],
  );

  const total = documents.length + videos.length + photos.length;

  if (isPending) {
    return (
      <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-4">
        <Skeleton className="h-4 w-28" />
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-24 w-full" />
      </div>
    );
  }

  if (total === 0) {
    return (
      <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-2 px-6 text-center">
        <Paperclip className="size-8 text-muted-foreground/50" />
        <p className="text-sm font-medium text-foreground">No files yet</p>
        <p className="text-xs text-muted-foreground">
          Attachments and Drive links from this thread will show up here.
        </p>
      </div>
    );
  }

  return (
    <div className="min-h-0 flex-1 overflow-y-auto p-4">
      <div className="mb-3 flex items-center justify-between gap-2">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
          Thread files
          <span className="ml-1 font-medium tabular-nums text-foreground/70">
            ({total})
          </span>
        </p>
      </div>
      <TicketMessageAttachments
        documents={documents}
        videos={videos}
        photos={photos}
        className="mt-0 border-0 pt-0"
      />
    </div>
  );
};
