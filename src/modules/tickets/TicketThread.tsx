import { Paperclip } from "lucide-react";
import { useListContext } from "ra-core";
import type { TicketMessage } from "@/modules/types";
import { cn } from "@/lib/utils";

const formatDateTime = (value?: string | null) => {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString();
};

export const TicketThread = () => {
  const { data = [], isPending } = useListContext<TicketMessage>();

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
        const sender =
          message.from_name?.trim() ||
          message.from_email?.trim() ||
          (inbound ? "Customer" : "Team");

        return (
          <div
            key={message.id}
            className={cn(
              "rounded-xl border px-4 py-3 text-sm",
              inbound ? "bg-background" : "border-sky-200 bg-sky-50/80",
            )}
          >
            <div className="mb-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
              <span className="font-medium text-foreground">{sender}</span>
              {message.from_email ? <span>{message.from_email}</span> : null}
              <span>·</span>
              <span>{formatDateTime(message.created_at)}</span>
            </div>
            <div className="whitespace-pre-wrap leading-relaxed">{message.body}</div>
            {Array.isArray(message.attachments) && message.attachments.length > 0 ? (
              <ul className="mt-3 space-y-1">
                {message.attachments.map((attachment, index) => {
                  const file = attachment as {
                    title?: string;
                    src?: string;
                  };
                  return (
                    <li key={`${message.id}-attachment-${index}`}>
                      <a
                        href={file.src}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1.5 text-xs font-medium text-primary hover:underline"
                      >
                        <Paperclip className="size-3.5" />
                        {file.title || "Attachment"}
                      </a>
                    </li>
                  );
                })}
              </ul>
            ) : null}
          </div>
        );
      })}
    </div>
  );
};
