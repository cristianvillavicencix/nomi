import { useEffect, useRef, useState } from "react";
import { useCreate, useGetIdentity, useNotify } from "ra-core";
import { Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { ClientSmsDraft, Contact, Conversation, ConversationMessage } from "@/lbs/types";
import { formatMessageTime } from "@/lbs/messages/conversationUtils";
import { useConversationMessages } from "@/lbs/messages/useConversationMessages";
import { useMarkConversationRead } from "@/lbs/messages/useMarkConversationRead";
import { useMessagesQuickAccessOptional } from "@/lbs/messages/messagesQuickAccessContext";
import {
  ClientSmsComposer,
  SmsMessageMedia,
} from "@/lbs/messages/ClientSmsComposer";
import { getContactDisplayName } from "@/lbs/messages/messageContactUtils";
import { cn } from "@/lib/utils";

const MessageBubble = ({
  message,
  isOwn,
  isClientSms,
}: {
  message: ConversationMessage;
  isOwn: boolean;
  isClientSms: boolean;
}) => {
  const inboundClient = isClientSms && message.direction === "inbound";

  return (
    <div className={cn("flex px-1", isOwn ? "justify-end" : "justify-start")}>
      <div
        className={cn(
          "max-w-[min(78%,520px)] rounded-2xl px-3.5 py-2 text-sm shadow-sm",
          isOwn
            ? "rounded-br-md bg-primary text-primary-foreground"
            : "rounded-bl-md border bg-background",
        )}
      >
        {message.media_url ? (
          <SmsMessageMedia
            url={message.media_url}
            alt={message.body || "Attachment"}
          />
        ) : null}
        {message.body ? (
          <div className="whitespace-pre-wrap break-words">{message.body}</div>
        ) : null}
        <div
          className={cn(
            "mt-1 flex items-center gap-2 text-[10px]",
            isOwn ? "text-primary-foreground/70" : "text-muted-foreground",
          )}
        >
          {isClientSms ? (
            <span className="rounded-full bg-muted/80 px-1.5 py-0.5 font-medium uppercase tracking-wide">
              SMS
            </span>
          ) : null}
          <span>{formatMessageTime(message.created_at)}</span>
          {inboundClient ? <span>Client</span> : null}
        </div>
      </div>
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
  const bottomRef = useRef<HTMLDivElement | null>(null);
  const [create, { isPending }] = useCreate();
  const { messages, isPending: isLoadingMessages, refetch } = useConversationMessages(
    conversation?.id,
  );

  const markConversationRead = messagesQuickAccess?.markConversationRead;

  useMarkConversationRead(conversation?.id, conversation?.type);

  const latestMessage = messages[messages.length - 1];
  useEffect(() => {
    if (!conversation?.id || !latestMessage || !markConversationRead) return;
    const readAt = latestMessage.created_at ?? conversation.last_message_at;
    if (!readAt) return;
    markConversationRead(conversation.id, readAt);
  }, [
    conversation?.id,
    conversation?.last_message_at,
    latestMessage?.created_at,
    latestMessage?.id,
    markConversationRead,
  ]);

  const isClientSms = conversation?.type === "client" || !!clientSmsDraft;
  const isDraftOnly = !conversation && !!clientSmsDraft;

  useEffect(() => {
    setBody("");
  }, [conversation?.id, clientSmsDraft?.contact.id]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length, conversation?.id, clientSmsDraft?.contact.id]);

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
        },
        onError: () => {
          notify("Failed to send message", { type: "error" });
        },
      },
    );
  };

  const draftLabel = clientSmsDraft
    ? getContactDisplayName(clientSmsDraft.contact)
    : null;
  const draftCompany = clientSmsDraft?.contact.company_name?.trim();

  return (
    <div className="flex h-full min-h-0 flex-col rounded-xl border bg-[radial-gradient(circle_at_top,rgba(0,0,0,0.02),transparent_55%)]">
      <div className="min-h-0 flex-1 space-y-2 overflow-y-auto px-3 py-4">
        {isDraftOnly ? (
          <div className="flex h-full min-h-[220px] flex-col items-center justify-center px-4 text-center">
            <p className="text-sm font-medium">{draftLabel}</p>
            {draftCompany ? (
              <p className="mt-1 text-sm text-muted-foreground">{draftCompany}</p>
            ) : null}
            <p className="mt-3 max-w-xs text-sm text-muted-foreground">
              Write your first message below. The conversation is created when you send.
            </p>
          </div>
        ) : isLoadingMessages ? null : messages.length === 0 ? (
          <div className="flex h-full min-h-[220px] items-center justify-center">
            <p className="max-w-xs text-center text-sm text-muted-foreground">{emptyLabel}</p>
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
              isClientSms={isClientSms}
            />
          ))
        )}
        <div ref={bottomRef} />
      </div>

      {isClientSms ? (
        <ClientSmsComposer
          contact={composerContact ?? clientSmsDraft?.contact}
          dealId={clientSmsDraft?.dealId ?? conversation?.deal_id}
          conversationId={conversation?.id}
          onSent={({ conversation: nextConversation, message }) => {
            onClientSmsSent?.(nextConversation);
            if (message && nextConversation?.id != null) {
              void refetch();
            }
          }}
        />
      ) : (
        <form
          onSubmit={handleSubmit}
          className="flex items-center gap-2 border-t bg-background px-3 py-3"
        >
          <Input
            value={body}
            onChange={(event) => setBody(event.target.value)}
            placeholder="Write a message..."
            className="h-11 rounded-full bg-muted/40 px-4"
          />
          <Button
            type="submit"
            size="icon"
            className="size-11 shrink-0 rounded-full"
            disabled={isPending || !body.trim()}
            aria-label="Send message"
          >
            <Send className="size-4" />
          </Button>
        </form>
      )}
    </div>
  );
};
