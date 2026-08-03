import { Fragment } from "react";
import type { Identifier } from "ra-core";
import type { ConversationMessage } from "@/modules/types";
import {
  ConversationMessageBubble,
  ConversationSystemMessageNote,
} from "@/modules/messages/ConversationMessageBubble";
import { ConversationVoiceCallNote } from "@/modules/voice/ConversationVoiceCallNote";
import type { ClientConversationTimelineItem } from "@/modules/voice/voiceCallTimeline";
import {
  formatMessageDateDivider,
  getMessageDayKey,
} from "@/modules/messages/conversationUtils";
import { cn } from "@/lib/utils";

export const ClientConversationTimelineList = ({
  timeline,
  compact = false,
  showDateDividers = false,
  isOwnMessage,
  onRetryDelivery,
  retryingMessageId,
}: {
  timeline: ClientConversationTimelineItem[];
  compact?: boolean;
  showDateDividers?: boolean;
  isOwnMessage?: (message: ConversationMessage) => boolean;
  onRetryDelivery?: (message: ConversationMessage) => void;
  retryingMessageId?: Identifier | null;
}) =>
  timeline.map((item, index) => {
    const at =
      item.kind === "message"
        ? item.message.created_at
        : item.at;
    const dayKey = getMessageDayKey(at);
    const prevItem = index > 0 ? timeline[index - 1] : null;
    const prevAt =
      prevItem?.kind === "message"
        ? prevItem.message.created_at
        : prevItem?.at;
    const prevDayKey = prevAt ? getMessageDayKey(prevAt) : null;
    const showDateDivider =
      showDateDividers && dayKey != null && dayKey !== prevDayKey;

    const key =
      item.kind === "message"
        ? `message-${item.message.id}`
        : `call-${item.call.id}`;

    return (
      <Fragment key={key}>
        {showDateDivider ? (
          <div
            className="flex items-center gap-3 py-1"
            role="separator"
            aria-label={formatMessageDateDivider(at)}
          >
            <div className="h-px flex-1 bg-border/60" />
            <span
              className={cn(
                "shrink-0 font-medium text-muted-foreground",
                compact ? "text-[10px]" : "text-[11px]",
              )}
            >
              {formatMessageDateDivider(at)}
            </span>
            <div className="h-px flex-1 bg-border/60" />
          </div>
        ) : null}
        {item.kind === "call" ? (
          <ConversationVoiceCallNote call={item.call} compact={compact} />
        ) : item.message.kind === "system" ? (
          <ConversationSystemMessageNote message={item.message} compact={compact} />
        ) : (
          <ConversationMessageBubble
            message={item.message}
            isOwn={isOwnMessage?.(item.message) ?? false}
            compact={compact}
            onRetryDelivery={onRetryDelivery}
            retryingDelivery={
              retryingMessageId != null &&
              String(retryingMessageId) === String(item.message.id)
            }
          />
        )}
      </Fragment>
    );
  });
