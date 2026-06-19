import { useMemo } from "react";
import type { ConversationMessage } from "@/modules/types";
import { AuthorBadge } from "@/components/atomic-crm/accountability/AuthorBadge";
import { formatMessageTime } from "@/modules/messages/conversationUtils";
import { SmsMessageMedia } from "@/modules/messages/ClientSmsComposer";
import { parseMessageBodyWithSignature } from "@/lib/signatures/signatureExpansion";
import { useOrganizationSmsSignature } from "@/modules/settings/useOrganizationSmsSignature";
import { cn } from "@/lib/utils";

export const ConversationSystemMessageNote = ({
  message,
  compact = false,
}: {
  message: ConversationMessage;
  compact?: boolean;
}) => (
  <div className="flex justify-center py-1">
    <div
      className={cn(
        "max-w-[min(85%,560px)] bg-muted/40 text-center text-muted-foreground",
        compact
          ? "rounded-none px-2 py-0.5 text-[10px]"
          : "rounded-full px-3 py-1 text-xs",
      )}
    >
      <span>{message.body}</span>
      {message.created_at ? (
        <span className="ml-2 opacity-70">
          · {formatMessageTime(message.created_at)}
        </span>
      ) : null}
    </div>
  </div>
);

export const ConversationMessageBubble = ({
  message,
  isOwn,
  compact = false,
}: {
  message: ConversationMessage;
  isOwn: boolean;
  compact?: boolean;
}) => {
  useOrganizationSmsSignature();
  const { content, signature } = useMemo(
    () =>
      message.direction === "outbound" && !message.is_internal_note
        ? parseMessageBodyWithSignature(message.body ?? "")
        : { content: message.body ?? "", signature: null },
    [message.body, message.direction, message.is_internal_note],
  );

  return (
    <div className={cn("flex flex-col", isOwn ? "items-end" : "items-start")}>
      <div
        className={cn(
          "max-w-[min(78%,560px)] leading-snug",
          compact
            ? "max-w-[min(92%,420px)] rounded-none px-2.5 py-1.5 text-xs leading-relaxed"
            : "rounded-2xl px-3.5 py-2.5 text-[15px]",
          message.is_internal_note
            ? "rounded-bl-md border border-amber-300/60 bg-amber-50 text-amber-950 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-50"
            : isOwn
              ? compact
                ? "rounded-none border border-border bg-muted/50 text-foreground dark:bg-muted/30"
                : "rounded-br-md border border-border bg-muted/50 text-foreground dark:bg-muted/30"
              : compact
                ? "rounded-none bg-muted/50 text-foreground dark:bg-muted/30"
                : "rounded-bl-md bg-muted/50 text-foreground dark:bg-muted/30",
        )}
      >
        {message.is_internal_note ? (
          <div
            className={cn(
              "mb-1 font-semibold uppercase tracking-wide text-amber-800/80 dark:text-amber-200/80",
              compact ? "text-[9px]" : "text-[10px]",
            )}
          >
            Internal — client cannot see this
          </div>
        ) : null}
        {message.media_url ? (
          <SmsMessageMedia
            url={message.media_url}
            alt={message.body || "Attachment"}
          />
        ) : null}
        {content ? (
          <div className="whitespace-pre-wrap break-words">{content}</div>
        ) : null}
        {signature ? (
          <p
            className={cn(
              "mt-1.5 italic text-muted-foreground/70",
              compact ? "text-[10px]" : "text-xs",
            )}
          >
            {signature}
          </p>
        ) : null}
        <div
          className={cn(
            "mt-1 text-muted-foreground",
            compact ? "text-[9px]" : "text-[10px]",
          )}
        >
          {formatMessageTime(message.created_at)}
        </div>
      </div>
      {!compact &&
      message.direction === "outbound" &&
      message.author_member_id &&
      !message.is_internal_note ? (
        <div className="mt-1 flex justify-end">
          <AuthorBadge memberId={message.author_member_id} size="sm" />
        </div>
      ) : null}
    </div>
  );
};
