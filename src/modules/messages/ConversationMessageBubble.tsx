import { useMemo } from "react";
import type { ConversationMessage } from "@/modules/types";
import { AuthorBadge } from "@/components/atomic-crm/accountability/AuthorBadge";
import {
  formatMessageTime,
  getMessageMediaUrls,
  isMediaPlaceholderBody,
} from "@/modules/messages/conversationUtils";
import { SmsMessageMedia } from "@/modules/messages/SmsMessageMedia";
import { parseMessageBodyWithSignature } from "@/lib/signatures/signatureExpansion";
import { useOrganizationSmsSignature } from "@/modules/settings/useOrganizationSmsSignature";
import { SmsDeliveryBadge } from "@/modules/messages/SmsDeliveryBadge";
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
  onRetryDelivery,
  retryingDelivery = false,
}: {
  message: ConversationMessage;
  isOwn: boolean;
  compact?: boolean;
  onRetryDelivery?: (message: ConversationMessage) => void;
  retryingDelivery?: boolean;
}) => {
  useOrganizationSmsSignature();
  const { content, signature } = useMemo(
    () =>
      message.direction === "outbound" && !message.is_internal_note
        ? parseMessageBodyWithSignature(message.body ?? "")
        : { content: message.body ?? "", signature: null },
    [message.body, message.direction, message.is_internal_note],
  );

  const mediaUrls = useMemo(() => getMessageMediaUrls(message), [message]);
  const showBody =
    content && !isMediaPlaceholderBody(content, mediaUrls.length);
  const hasMultiplePhotos = mediaUrls.length > 1;

  return (
    <div className={cn("flex flex-col", isOwn ? "items-end" : "items-start")}>
      <div
        className={cn(
          hasMultiplePhotos
            ? "max-w-[min(92%,520px)]"
            : "max-w-[min(78%,560px)]",
          "leading-snug",
          compact
            ? "max-w-[min(92%,420px)] px-2.5 py-1.5 text-xs leading-relaxed"
            : "px-3.5 py-2.5 text-[15px]",
          compact ? "rounded-none" : "rounded-sm",
          message.is_internal_note
            ? "border border-amber-300/50 bg-amber-50 text-amber-950 dark:border-amber-500/25 dark:bg-amber-500/10 dark:text-amber-50"
            : isOwn
              ? "bg-muted/70 text-foreground dark:bg-muted/45"
              : "bg-muted/50 text-foreground dark:bg-muted/35",
        )}
      >
        {message.is_internal_note ? (
          <div
            className={cn(
              "mb-1 font-semibold uppercase tracking-wide text-warning",
              compact ? "text-[9px]" : "text-[10px]",
            )}
          >
            Internal — client cannot see this
          </div>
        ) : null}
        {mediaUrls.length > 0 ? (
          <SmsMessageMedia
            urls={mediaUrls}
            alt={message.body || "Attachment"}
          />
        ) : null}
        {showBody ? (
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
            "mt-1 flex items-center gap-2 text-muted-foreground",
            compact ? "text-[9px]" : "text-[10px]",
          )}
        >
          <span>{formatMessageTime(message.created_at)}</span>
          <SmsDeliveryBadge
            message={message}
            compact={compact}
            onRetry={onRetryDelivery}
            retrying={retryingDelivery}
          />
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
