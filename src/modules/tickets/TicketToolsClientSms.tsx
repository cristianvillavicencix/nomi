import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Loader2, Send } from "lucide-react";
import { useDataProvider } from "ra-core";
import type { Contact } from "@/components/atomic-crm/types";
import type { CrmDataProvider } from "@/components/atomic-crm/providers/types";
import { useMemberCapability } from "@/components/atomic-crm/providers/commons/useMemberCapability";
import type { Conversation, Ticket } from "@/modules/types";
import { formatMessageTime } from "@/modules/messages/conversationUtils";
import {
  contactHasSmsPhone,
  getContactDisplayName,
  getContactPhoneLabel,
} from "@/modules/messages/messageContactUtils";
import { useConversationMessages } from "@/modules/messages/useConversationMessages";
import { useMessagingEnabled } from "@/modules/messages/useMessagingEnabled";
import { useSendClientSms } from "@/modules/messages/useClientSms";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

type TicketToolsClientSmsProps = {
  ticket: Ticket;
  contact?: Contact | null;
};

export const TicketToolsClientSms = ({
  ticket,
  contact,
}: TicketToolsClientSmsProps) => {
  const dataProvider = useDataProvider<CrmDataProvider>();
  const { smsEnabled, isPending: messagingPending } = useMessagingEnabled();
  const canSendMessages = useMemberCapability("messaging.send");
  const sendClientSms = useSendClientSms();
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const [body, setBody] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [conversation, setConversation] = useState<Conversation | null>(null);

  const {
    data: loadedConversation,
    isPending: conversationPending,
    isError: conversationError,
  } = useQuery({
    queryKey: ["ticket-client-conversation", contact?.id],
    queryFn: () =>
      contact?.id
        ? dataProvider.findClientConversationForContact(contact.id)
        : Promise.resolve(null),
    enabled: Boolean(contact?.id && contactHasSmsPhone(contact)),
    staleTime: 30_000,
  });

  useEffect(() => {
    setConversation(loadedConversation ?? null);
  }, [loadedConversation]);

  const { messages, isPending: messagesPending } = useConversationMessages(
    conversation?.id,
  );

  useEffect(() => {
    const node = scrollRef.current;
    if (!node) return;
    node.scrollTop = node.scrollHeight;
  }, [messages.length, conversation?.id]);

  if (!contact) {
    return (
      <p className="text-xs text-muted-foreground">
        Link a contact on this ticket to text the client.
      </p>
    );
  }

  if (messagingPending) {
    return (
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <Loader2 className="size-3.5 animate-spin" />
        Loading messaging…
      </div>
    );
  }

  if (!smsEnabled) {
    return (
      <p className="text-xs text-muted-foreground">
        SMS is not enabled. Turn it on in Settings → Messaging.
      </p>
    );
  }

  if (!contactHasSmsPhone(contact)) {
    return (
      <p className="text-xs text-muted-foreground">
        Add a phone number to {getContactDisplayName(contact)} to send texts.
      </p>
    );
  }

  if (!canSendMessages) {
    return (
      <p className="text-xs text-muted-foreground">
        You don&apos;t have permission to send messages.
      </p>
    );
  }

  const clientName = getContactDisplayName(contact);
  const phoneLabel = getContactPhoneLabel(contact);
  const visibleMessages = messages
    .filter((message) => !message.is_internal_note)
    .slice(-8);

  const isLoadingMessages =
    conversationPending || (conversation?.id != null && messagesPending);

  const handleSend = async () => {
    const trimmed = body.trim();
    if (!trimmed || isSending) return;

    setIsSending(true);
    try {
      const result = await sendClientSms({
        conversationId: conversation?.id,
        contactId: contact.id,
        dealId: ticket.deal_id ?? undefined,
        body: trimmed,
      });
      if (result.conversation) {
        setConversation(result.conversation);
      }
      setBody("");
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div className="space-y-3">
      <p className="text-xs text-muted-foreground">
        {clientName} · {phoneLabel}
      </p>

      <div
        ref={scrollRef}
        className="max-h-40 space-y-2 overflow-y-auto border border-border/70 bg-muted/15 px-3 py-2"
      >
        {conversationError ? (
          <p className="py-4 text-center text-xs text-destructive">
            Could not load conversation.
          </p>
        ) : isLoadingMessages ? (
          <div className="flex items-center gap-2 py-4 text-xs text-muted-foreground">
            <Loader2 className="size-3.5 animate-spin" />
            Loading messages…
          </div>
        ) : visibleMessages.length > 0 ? (
          visibleMessages.map((message) => {
            const outbound = message.direction === "outbound";
            return (
              <div
                key={message.id}
                className={cn("flex", outbound ? "justify-end" : "justify-start")}
              >
                <div
                  className={cn(
                    "max-w-[92%] px-2.5 py-1.5 text-xs leading-snug",
                    outbound
                      ? "bg-primary text-primary-foreground"
                      : "bg-background text-foreground",
                  )}
                >
                  <p className="whitespace-pre-wrap break-words">{message.body}</p>
                  {message.created_at ? (
                    <p
                      className={cn(
                        "mt-1 text-[10px]",
                        outbound
                          ? "text-primary-foreground/70"
                          : "text-muted-foreground",
                      )}
                    >
                      {formatMessageTime(message.created_at)}
                    </p>
                  ) : null}
                </div>
              </div>
            );
          })
        ) : (
          <p className="py-4 text-center text-xs text-muted-foreground">
            No texts with this client yet.
          </p>
        )}
      </div>

      <div className="flex items-end gap-2">
        <Textarea
          value={body}
          onChange={(event) => setBody(event.target.value)}
          placeholder={`Text ${clientName.split(" ")[0] || "client"}…`}
          rows={2}
          disabled={isSending}
          className="min-h-[4.5rem] resize-none text-sm"
          onKeyDown={(event) => {
            if (event.key === "Enter" && !event.shiftKey) {
              event.preventDefault();
              void handleSend();
            }
          }}
        />
        <Button
          type="button"
          size="icon"
          className="size-9 shrink-0"
          disabled={!body.trim() || isSending}
          aria-label="Send text"
          onClick={() => void handleSend()}
        >
          {isSending ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <Send className="size-4" />
          )}
        </Button>
      </div>
    </div>
  );
};
