import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { useCreate, useGetIdentity, useNotify, type Identifier } from "ra-core";
import { Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { IconButton } from "@/components/ui/icon-button";
import { Input } from "@/components/ui/input";
import type {
  ClientSmsDraft,
  Contact,
  Conversation,
} from "@/modules/types";
import { useClientConversationTimeline } from "@/modules/messages/useClientConversationTimeline";
import { ClientConversationTimelineList } from "@/modules/messages/ClientConversationTimelineList";
import { useMarkConversationRead } from "@/modules/messages/useMarkConversationRead";
import { useResendFailedSmsMessage } from "@/modules/messages/useResendFailedSmsMessage";
import { useMessagesQuickAccessOptional } from "@/modules/messages/messagesQuickAccessContext";
import { ClientSmsComposer } from "@/modules/messages/ClientSmsComposer";
import { getClientSmsDraftLabel } from "@/modules/messages/messageContactUtils";
import { useMemberCapability } from "@/components/atomic-crm/providers/commons/useMemberCapability";
import {
  SMS_COMPOSER_FORM_PROPS,
  TEAM_MESSAGE_INPUT_PROPS,
} from "@/modules/messages/smsComposerInputProps";
import { cn } from "@/lib/utils";

const SEND_MESSAGES_CAPABILITY = "messaging.send";

const SendDisabledNotice = () => (
  <p className="text-center text-sm text-muted-foreground">
    You don&apos;t have permission to send messages. Ask an administrator to
    enable <span className="text-foreground">Send messages</span> in Settings →
    Users.
  </p>
);

export const ConversationThread = ({
  conversation,
  clientSmsDraft,
  composerContact,
  onClientSmsSent,
  clientSmsExternalPhone,
  onClientSmsPhoneChange,
  emptyLabel = "No messages yet. Say hello to the team.",
  layout = "default",
}: {
  conversation: Conversation | null;
  clientSmsDraft?: ClientSmsDraft | null;
  composerContact?: Contact | null;
  onClientSmsSent?: (conversation: Conversation) => void;
  clientSmsExternalPhone?: string | null;
  onClientSmsPhoneChange?: (phone: string) => void;
  emptyLabel?: string;
  layout?: "default" | "sidebar";
}) => {
  const { identity } = useGetIdentity();
  const notify = useNotify();
  const messagesQuickAccess = useMessagesQuickAccessOptional();
  const [body, setBody] = useState("");
  const [replyToMessageId, setReplyToMessageId] = useState<Identifier | null>(
    null,
  );
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);
  const bottomRef = useRef<HTMLDivElement | null>(null);
  const composerInputRef = useRef<HTMLInputElement | null>(null);
  const [create, { isPending }] = useCreate();
  const canSendMessages = useMemberCapability(SEND_MESSAGES_CAPABILITY);
  const includeCallTimeline =
    conversation?.type === "client" || !!clientSmsDraft;
  const {
    messages,
    timeline,
    isPending: isLoadingMessages,
    refetch,
    loadOlder,
    hasMoreOlder,
    loadingOlder,
  } = useClientConversationTimeline(conversation?.id, {
    includeCalls: includeCallTimeline,
  });

  const markConversationRead = messagesQuickAccess?.markConversationRead;
  const latestMessage = messages[messages.length - 1];

  useMarkConversationRead(
    conversation?.id,
    conversation?.type,
    latestMessage?.created_at ?? conversation?.last_message_at,
  );

  const isClientSms = conversation?.type === "client" || !!clientSmsDraft;
  const isDraftOnly = !conversation && !!clientSmsDraft;

  const { retryMessage, retryingMessageId } = useResendFailedSmsMessage({
    enabled: isClientSms && canSendMessages,
    onSent: () => {
      void refetch();
    },
  });

  useEffect(() => {
    setBody("");
    setReplyToMessageId(null);
  }, [
    conversation?.id,
    clientSmsDraft?.contact?.id,
    clientSmsDraft?.externalPhone,
  ]);

  useLayoutEffect(() => {
    if (!conversation && !clientSmsDraft) return;
    if (isLoadingMessages && timeline.length === 0) return;

    const container = scrollContainerRef.current;
    if (!container) return;

    container.scrollTop = container.scrollHeight;
  }, [
    timeline.length,
    conversation?.id,
    clientSmsDraft?.contact?.id,
    clientSmsDraft?.externalPhone,
    isLoadingMessages,
    conversation,
    clientSmsDraft,
  ]);

  if (!conversation && !clientSmsDraft) {
    return null;
  }

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    const trimmed = body.trim();
    if (!trimmed) return;

    if (isClientSms) {
      return;
    }

    if (!canSendMessages) {
      notify("You don't have permission to send messages.", {
        type: "warning",
      });
      return;
    }

    if (!conversation) return;

    create(
      "conversation_messages",
      {
        data: {
          conversation_id: conversation.id,
          author_member_id: identity?.id,
          body: trimmed,
          channel: "internal",
          direction: "outbound",
        },
      },
      {
        onSuccess: () => {
          setBody("");
          const sentAt = new Date().toISOString();
          markConversationRead?.(conversation.id, sentAt);
          window.setTimeout(() => {
            composerInputRef.current?.focus();
          }, 0);
        },
        onError: () => {
          notify(
            "Failed to send message. You may not have permission to send messages.",
            {
              type: "error",
            },
          );
        },
      },
    );
  };

  const draftLabel = clientSmsDraft
    ? getClientSmsDraftLabel(clientSmsDraft)
    : null;
  const draftCompany = clientSmsDraft?.contact?.company_name?.trim();
  const draftIsUnsavedNumber =
    !clientSmsDraft?.contact && Boolean(clientSmsDraft?.externalPhone);

  const isSidebar = layout === "sidebar";

  return (
    <div
      className={cn(
        "flex h-full min-h-0 flex-col bg-background",
        isSidebar && "overflow-hidden",
      )}
    >
      <div
        ref={scrollContainerRef}
        className={cn(
          "min-h-0 flex-1 overflow-y-auto overscroll-contain",
          isSidebar ? "space-y-2 px-3 py-2" : "space-y-3 px-4 py-4",
        )}
      >
        {hasMoreOlder ? (
          <div className="flex justify-center pb-2">
            <Button
              type="button"
              variant="secondary"
              size="sm"
              disabled={loadingOlder}
              onClick={() => void loadOlder()}
            >
              {loadingOlder ? "Loading…" : "Load older messages"}
            </Button>
          </div>
        ) : null}
        {isDraftOnly ? (
          <div
            className={cn(
              "flex flex-col items-center justify-center px-4 py-8 text-center",
              !isSidebar && "h-full min-h-[220px]",
            )}
          >
            <p className="text-sm font-medium">{draftLabel}</p>
            {draftCompany ? (
              <p className="mt-1 text-sm text-muted-foreground">
                {draftCompany}
              </p>
            ) : draftIsUnsavedNumber ? (
              <p className="mt-1 text-sm text-muted-foreground">
                Unsaved number
              </p>
            ) : null}
            <p className="mt-3 max-w-xs text-sm text-muted-foreground">
              Write your first message below. The conversation is created when
              you send.
            </p>
          </div>
        ) : isLoadingMessages ? null : timeline.length === 0 ? (
          <div
            className={cn(
              "flex items-center justify-center",
              isSidebar ? "py-8" : "h-full min-h-[220px]",
            )}
          >
            <p
              className={cn(
                "max-w-xs text-center text-muted-foreground",
                isSidebar ? "text-xs" : "text-sm",
              )}
            >
              {emptyLabel}
            </p>
          </div>
        ) : (
          <ClientConversationTimelineList
            timeline={timeline}
            compact={isSidebar}
            showDateDividers={!isSidebar}
            isOwnMessage={(message) =>
              isClientSms
                ? message.direction === "outbound"
                : String(message.author_member_id) === String(identity?.id)
            }
            onRetryDelivery={isClientSms ? retryMessage : undefined}
            retryingMessageId={isClientSms ? retryingMessageId : undefined}
          />
        )}
        <div ref={bottomRef} />
      </div>

      {isClientSms ? (
        <div
          className={cn(
            "mt-auto shrink-0 bg-background",
            isSidebar && "border-t border-border/70",
          )}
        >
          <ClientSmsComposer
            contact={composerContact ?? clientSmsDraft?.contact}
            dealId={clientSmsDraft?.dealId ?? conversation?.deal_id}
            conversationId={conversation?.id}
            replyToMessageId={replyToMessageId}
            disabled={!canSendMessages}
            externalPhone={clientSmsExternalPhone}
            onExternalPhoneChange={onClientSmsPhoneChange}
            onSent={({ conversation: nextConversation, message }) => {
              onClientSmsSent?.(nextConversation);
              if (message?.created_at && nextConversation?.id != null) {
                markConversationRead?.(nextConversation.id, message.created_at);
              }
              if (message && nextConversation?.id != null) {
                void refetch();
              }
            }}
          />
        </div>
      ) : canSendMessages ? (
        <form
          onSubmit={handleSubmit}
          {...SMS_COMPOSER_FORM_PROPS}
          className={cn(
            "mt-auto shrink-0 border-t border-border/70 bg-background",
            isSidebar
              ? "px-3 py-2"
              : "px-4 pb-[max(1rem,env(safe-area-inset-bottom,0px))] pt-3",
          )}
        >
          <div className="flex items-end gap-0.5 rounded-full border border-border/40 bg-card px-1.5 py-1 shadow-sm">
            <Input
              ref={composerInputRef}
              value={body}
              onChange={(event) => setBody(event.target.value)}
              placeholder="Write a message…"
              {...TEAM_MESSAGE_INPUT_PROPS}
              className="h-10 flex-1 border-0 bg-transparent px-2 shadow-none focus-visible:ring-0"
            />
            <IconButton
              type="submit"
              variant="primary"
              className="mb-0.5 mr-0.5 size-9 shrink-0 rounded-full"
              disabled={isPending || !body.trim()}
              aria-label="Send message"
            >
              <Send className="size-4" strokeWidth={2.5} />
            </IconButton>
          </div>
        </form>
      ) : (
        <div className="mt-auto shrink-0 px-4 py-4">
          <SendDisabledNotice />
        </div>
      )}
    </div>
  );
};
