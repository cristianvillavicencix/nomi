import { useListContext } from "ra-core";
import {
  FileAttachmentPillList,
  getFileKind,
  type FileAttachment,
} from "@/lib/fileAttachments";
import type { TicketMessage } from "@/modules/types";
import { TicketMessageBody } from "@/modules/tickets/TicketMessageBody";
import { useTicketReadCutoff } from "@/modules/tickets/TicketReadCutoffContext";
import { isInboundMessageUnread } from "@/modules/tickets/ticketReadState";
import { formatTicketMessageTime } from "@/modules/tickets/ticketInboxUi";
import { cn } from "@/lib/utils";
import { Lock } from "lucide-react";

export const TicketThread = () => {
  const { data = [], isPending } = useListContext<TicketMessage>();
  const readCutoff = useTicketReadCutoff();

  if (isPending) return null;

  if (!data.length) {
    return (
      <p className="py-8 text-center text-sm text-muted-foreground">
        No messages on this ticket yet.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      {data.map((message) => {
        const inbound = message.direction === "inbound";
        const isInternal = message.direction === "internal";
        const senderEmail = message.from_email?.trim();
        const senderName = message.from_name?.trim();
        const senderLabel =
          senderEmail && senderName
            ? `${senderEmail} · ${senderName}`
            : senderEmail || senderName || (inbound ? "Customer" : "Team");

        const attachments = Array.isArray(message.attachments)
          ? (message.attachments as FileAttachment[])
          : [];
        const imageAttachments = attachments.filter(
          (file) => getFileKind(file) === "image" && file.src,
        );
        const fileAttachments = attachments.filter(
          (file) => getFileKind(file) !== "image" || !file.src,
        );

        if (isInternal) {
          const author = senderName || "Team";
          return (
            <div key={message.id} className="flex justify-center">
              <div className="inline-flex max-w-full items-center gap-2 rounded-full border border-amber-200 bg-amber-50 px-4 py-2 text-xs text-amber-950">
                <Lock className="size-3.5 shrink-0" />
                <span className="font-medium">Internal note</span>
                <span>·</span>
                <span className="font-medium">{author}:</span>
                <span className="truncate">{message.body}</span>
              </div>
            </div>
          );
        }

        const unreadInbound = isInboundMessageUnread(message, readCutoff);

        return (
          <div
            key={message.id}
            className={cn(
              "rounded-2xl border px-4 py-3 text-sm transition-colors",
              inbound
                ? unreadInbound
                  ? "border-sky-200/90 bg-sky-50/90"
                  : "border-border/70 bg-muted/30"
                : "border-sky-200 bg-sky-50/70",
            )}
          >
            <div className="mb-2 flex items-start justify-between gap-3 text-xs">
              <span
                className={cn(
                  "min-w-0 truncate font-semibold",
                  inbound ? "text-foreground" : "text-sky-800",
                )}
              >
                {senderLabel}
              </span>
              <span className="shrink-0 text-muted-foreground">
                {formatTicketMessageTime(message.created_at)}
              </span>
            </div>
            <div className={cn(!inbound && "text-sky-950")}>
              <TicketMessageBody body={message.body} htmlBody={message.html_body} />
            </div>
            {imageAttachments.length > 0 ? (
              <div className="mt-3 flex flex-wrap gap-2">
                {imageAttachments.map((file, index) => (
                  <a
                    key={`${message.id}-image-${index}`}
                    href={file.src}
                    target="_blank"
                    rel="noreferrer"
                    title={file.title || "Image attachment"}
                    className="block overflow-hidden rounded-lg border"
                  >
                    <img
                      src={file.src}
                      alt={file.title || "Attachment"}
                      className="max-h-48 max-w-full object-contain"
                    />
                  </a>
                ))}
              </div>
            ) : null}
            {fileAttachments.length > 0 ? (
              <FileAttachmentPillList attachments={fileAttachments} />
            ) : null}
          </div>
        );
      })}
    </div>
  );
};
