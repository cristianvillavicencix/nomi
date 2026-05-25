import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useCreate, useGetIdentity, useNotify, type Identifier } from "ra-core";
import { Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type {
  ClientSmsDraft,
  Contact,
  Conversation,
  ConversationMessage,
} from "@/lbs/types";
import { AuthorBadge } from "@/components/atomic-crm/accountability/AuthorBadge";
import { formatMessageTime } from "@/lbs/messages/conversationUtils";
import { useConversationMessages } from "@/lbs/messages/useConversationMessages";
import { useMarkConversationRead } from "@/lbs/messages/useMarkConversationRead";
import { useMessagesQuickAccessOptional } from "@/lbs/messages/messagesQuickAccessContext";
import {
  ClientSmsComposer,
  SmsMessageMedia,
} from "@/lbs/messages/ClientSmsComposer";
import { getContactDisplayName } from "@/lbs/messages/messageContactUtils";
import { useMemberCapability } from "@/components/atomic-crm/providers/commons/useMemberCapability";
import { parseMessageBodyWithSignature } from "@/lib/signatures/signatureExpansion";
import { useOrganizationSmsSignature } from "@/lbs/settings/useOrganizationSmsSignature";
import { cn } from "@/lib/utils";

const SEND_MESSAGES_CAPABILITY = "messaging.send";

const SendDisabledNotice = () => (
  <p className="text-center text-sm text-muted-foreground">
    You don&apos;t have permission to send messages. Ask an administrator to
    enable <span className="text-foreground">Send messages</span> in Settings →
    Users.
  </p>
);

const MessageBubble = ({
  message,
  isOwn,
}: {
  message: ConversationMessage;
  isOwn: boolean;
}) => {
  const { settings } = useOrganizationSmsSignature();
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
          "max-w-[min(78%,560px)] rounded-2xl px-3.5 py-2.5 text-[15px] leading-snug",
          message.is_internal_note
            ? "rounded-bl-md border border-amber-300/60 bg-amber-50 text-amber-950 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-50"
            : isOwn
              ? "rounded-br-md bg-primary text-primary-foreground"
              : "rounded-bl-md bg-muted/50 text-foreground dark:bg-muted/30",
        )}
      >
        {message.is_internal_note ? (
          <div className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-amber-800/80 dark:text-amber-200/80">
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
              "mt-2 text-xs italic",
              isOwn ? "text-primary-foreground/70" : "text-muted-foreground/70",
            )}
          >
            {signature}
          </p>
        ) : null}
        <div
          className={cn(
            "mt-1 text-[10px]",
            isOwn ? "text-primary-foreground/70" : "text-muted-foreground",
          )}
        >
          {formatMessageTime(message.created_at)}
        </div>
      </div>
      {message.direction === "outbound" &&
      message.author_member_id &&
      !message.is_internal_note ? (
        <div className="mt-1 flex justify-end">
          <AuthorBadge memberId={message.author_member_id} size="sm" />
        </div>
      ) : null}
    </div>
  );
};

export const ConversationThread = ({
  conversation,
  clientSmsDraft,
  composerContact,
  onClientSmsSent,
  emptyLabel = "No messages yet. Say hello to the team.",
}: {
  conversation: Conversation | null;
  clientSmsDraft?: ClientSmsDraft | null;
  composerContact?: Contact | null;
  onClientSmsSent?: (conversation: Conversation) => void;
  emptyLabel?: string;
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
  const {
    messages,
    isPending: isLoadingMessages,
    refetch,
    loadOlder,
    hasMoreOlder,
    loadingOlder,
  } = useConversationMessages(conversation?.id);

  const markConversationRead = messagesQuickAccess?.markConversationRead;
  const latestMessage = messages[messages.length - 1];

  useMarkConversationRead(
    conversation?.id,
    conversation?.type,
    latestMessage?.created_at ?? conversation?.last_message_at,
  );

  const isClientSms = conversation?.type === "client" || !!clientSmsDraft;
  const isDraftOnly = !conversation && !!clientSmsDraft;

  useEffect(() => {
    setBody("");
    setReplyToMessageId(null);
  }, [conversation?.id, clientSmsDraft?.contact.id]);

  useLayoutEffect(() => {
    if (!conversation && !clientSmsDraft) return;
    if (isLoadingMessages && messages.length === 0) return;

    const container = scrollContainerRef.current;
    if (!container) return;

    container.scrollTop = container.scrollHeight;
  }, [
    messages.length,
    conversation?.id,
    clientSmsDraft?.contact.id,
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
    ? getContactDisplayName(clientSmsDraft.contact)
    : null;
  const draftCompany = clientSmsDraft?.contact.company_name?.trim();

  return (
    <div className="flex h-full min-h-0 flex-col bg-background">
      <div
        ref={scrollContainerRef}
        className="min-h-0 flex-1 space-y-3 overflow-y-auto px-4 py-4"
      >
        {hasMoreOlder ? (
          <div className="flex justify-center pb-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={loadingOlder}
              onClick={() => void loadOlder()}
            >
              {loadingOlder ? "Loading…" : "Load older messages"}
            </Button>
          </div>
        ) : null}
        {isDraftOnly ? (
          <div className="flex h-full min-h-[220px] flex-col items-center justify-center px-4 text-center">
            <p className="text-sm font-medium">{draftLabel}</p>
            {draftCompany ? (
              <p className="mt-1 text-sm text-muted-foreground">
                {draftCompany}
              </p>
            ) : null}
            <p className="mt-3 max-w-xs text-sm text-muted-foreground">
              Write your first message below. The conversation is created when
              you send.
            </p>
          </div>
        ) : isLoadingMessages ? null : messages.length === 0 ? (
          <div className="flex h-full min-h-[220px] items-center justify-center">
            <p className="max-w-xs text-center text-sm text-muted-foreground">
              {emptyLabel}
            </p>
          </div>
        ) : (
          messages.map((message) => (
            <MessageBubble
              key={String(message.id)}
              message={message}
              isOwn={
                isClientSms
                  ? message.direction === "outbound"
                  : String(message.author_member_id) === String(identity?.id)
              }
            />
          ))
        )}
        <div ref={bottomRef} />
      </div>

      {isClientSms ? (
        <div className="mt-auto shrink-0 bg-background">
          <ClientSmsComposer
            contact={composerContact ?? clientSmsDraft?.contact}
            dealId={clientSmsDraft?.dealId ?? conversation?.deal_id}
            conversationId={conversation?.id}
            replyToMessageId={replyToMessageId}
            disabled={!canSendMessages}
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
          className="mt-auto shrink-0 border-t border-border/40 bg-background px-4 pt-5 pb-[max(1rem,env(safe-area-inset-bottom,0px))]"
        >
          <div className="flex items-center gap-2 rounded-full border border-border/60 bg-muted/25 px-1 py-1 pl-4 shadow-none dark:bg-muted/20">
            <Input
              ref={composerInputRef}
              value={body}
              onChange={(event) => setBody(event.target.value)}
              placeholder="Write a message…"
              className="h-10 flex-1 border-0 bg-transparent px-0 shadow-none focus-visible:ring-0"
            />
            <Button
              type="submit"
              size="icon"
              className="size-9 shrink-0 rounded-full"
              disabled={isPending || !body.trim()}
              aria-label="Send message"
            >
              <Send className="size-4" />
            </Button>
          </div>
        </form>
      ) : (
        <div className="mt-auto shrink-0 border-t border-border/40 px-4 py-4">
          <SendDisabledNotice />
        </div>
      )}
    </div>
  );
};
