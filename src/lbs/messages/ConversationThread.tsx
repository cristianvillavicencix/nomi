import { useEffect, useRef, useState } from "react";
import { useCreate, useGetIdentity, useNotify } from "ra-core";
import { Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { Conversation, ConversationMessage } from "@/lbs/types";
import { formatMessageTime } from "@/lbs/messages/conversationUtils";
import { useConversationMessages } from "@/lbs/messages/useConversationMessages";
import { useMarkConversationRead } from "@/lbs/messages/useMarkConversationRead";
import { useSendClientSms } from "@/lbs/messages/useClientSms";
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
        <div className="whitespace-pre-wrap break-words">{message.body}</div>
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
  emptyLabel = "No messages yet. Say hello to the team.",
}: {
  conversation: Conversation | null;
  emptyLabel?: string;
}) => {
  const { identity } = useGetIdentity();
  const notify = useNotify();
  const [body, setBody] = useState("");
  const bottomRef = useRef<HTMLDivElement | null>(null);
  const [create, { isPending }] = useCreate();
  const sendClientSms = useSendClientSms();
  const { messages, isPending: isLoadingMessages, refetch } = useConversationMessages(
    conversation?.id,
  );

  useMarkConversationRead(conversation?.id, conversation?.type);

  const isClientSms = conversation?.type === "client";

  useEffect(() => {
    setBody("");
  }, [conversation?.id]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length, conversation?.id]);

  if (!conversation) {
    return null;
  }

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    const trimmed = body.trim();
    if (!trimmed) return;

    if (isClientSms) {
      try {
        await sendClientSms(conversation.id, trimmed);
        setBody("");
        void refetch();
      } catch (error) {
        notify(error instanceof Error ? error.message : "Failed to send SMS", {
          type: "error",
        });
      }
      return;
    }

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

  return (
    <div className="flex h-full min-h-0 flex-col rounded-xl border bg-[radial-gradient(circle_at_top,rgba(0,0,0,0.02),transparent_55%)]">
      <div className="min-h-0 flex-1 space-y-2 overflow-y-auto px-3 py-4">
        {isLoadingMessages ? null : messages.length === 0 ? (
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

      <form
        onSubmit={handleSubmit}
        className="flex items-center gap-2 border-t bg-background px-3 py-3"
      >
        <Input
          value={body}
          onChange={(event) => setBody(event.target.value)}
          placeholder={isClientSms ? "Write an SMS..." : "Write a message..."}
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
    </div>
  );
};
