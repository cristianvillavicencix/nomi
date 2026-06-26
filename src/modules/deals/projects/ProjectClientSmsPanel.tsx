import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { useDataProvider, useGetOne } from "ra-core";
import type { Contact } from "@/components/atomic-crm/types";
import type { CrmDataProvider } from "@/components/atomic-crm/providers/types";
import { useMemberCapability } from "@/components/atomic-crm/providers/commons/useMemberCapability";
import type { Conversation, LbsDeal } from "@/modules/types";
import { getInitials } from "@/modules/messages/conversationDisplay";
import {
  contactHasSmsPhone,
  getContactDisplayName,
  getContactPhoneLabel,
} from "@/modules/messages/messageContactUtils";
import { useConversationMessages } from "@/modules/messages/useConversationMessages";
import { useMessagingEnabled } from "@/modules/messages/useMessagingEnabled";
import { ClientSmsComposer } from "@/modules/messages/ClientSmsComposer";
import {
  ConversationMessageBubble,
  ConversationSystemMessageNote,
} from "@/modules/messages/ConversationMessageBubble";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";

const resolveMainContactId = (record: LbsDeal) => {
  if (record.contact_id != null) return Number(record.contact_id);
  if (Array.isArray(record.contact_ids) && record.contact_ids.length > 0) {
    return Number(record.contact_ids[0]);
  }
  return null;
};

export const ProjectClientSmsPanel = ({
  record,
  className,
}: {
  record: LbsDeal;
  className?: string;
}) => {
  const dataProvider = useDataProvider<CrmDataProvider>();
  const { smsEnabled, isPending: messagingPending } = useMessagingEnabled();
  const canSendMessages = useMemberCapability("messaging.send");
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const [conversation, setConversation] = useState<Conversation | null>(null);

  const contactId = resolveMainContactId(record);
  const { data: contact } = useGetOne<Contact>(
    "contacts",
    { id: contactId as number },
    { enabled: contactId != null },
  );

  const {
    data: loadedConversation,
    isPending: conversationPending,
    isError: conversationError,
  } = useQuery({
    queryKey: ["project-client-conversation", contact?.id, record.id],
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
  }, [messages.length]);

  const renderEmptyState = (message: string) => (
    <div
      className={cn(
        "flex flex-1 items-center justify-center px-4 py-8 text-center text-xs text-muted-foreground",
        className,
      )}
    >
      {message}
    </div>
  );

  if (!contact) {
    return renderEmptyState("Link a contact to this project to text the client.");
  }

  if (messagingPending || conversationPending) {
    return (
      <div
        className={cn(
          "flex items-center gap-2 px-4 py-4 text-xs text-muted-foreground",
          className,
        )}
      >
        <Loader2 className="size-3.5 animate-spin" />
        Loading messaging…
      </div>
    );
  }

  if (!smsEnabled) {
    return renderEmptyState(
      "SMS is not enabled. Turn it on in Settings → Communications.",
    );
  }

  if (!contactHasSmsPhone(contact)) {
    return renderEmptyState(
      `Add a phone number to ${getContactDisplayName(contact)} to send texts.`,
    );
  }

  if (!canSendMessages) {
    return renderEmptyState("You don't have permission to send messages.");
  }

  const clientName = getContactDisplayName(contact);
  const phoneLabel = getContactPhoneLabel(contact);
  const isLoadingMessages =
    conversation?.id != null && messagesPending && messages.length === 0;

  return (
    <div className={cn("flex min-h-0 flex-1 flex-col", className)}>
      <div className="flex items-center gap-2.5 border-b border-border/70 px-3 py-2">
        <Avatar className="size-8 rounded-full">
          <AvatarFallback className="rounded-full bg-emerald-500/10 text-xs font-medium text-emerald-800 dark:text-emerald-200">
            {getInitials(clientName)}
          </AvatarFallback>
        </Avatar>
        <div className="min-w-0">
          <p className="truncate text-xs font-medium">{clientName}</p>
          <p className="truncate text-[11px] text-muted-foreground">
            {phoneLabel}
          </p>
        </div>
      </div>

      <div
        ref={scrollRef}
        className="min-h-0 flex-1 space-y-2 overflow-y-auto px-3 py-2"
      >
        {conversationError ? (
          <p className="py-6 text-center text-xs text-destructive">
            Could not load conversation.
          </p>
        ) : isLoadingMessages ? (
          <div className="flex items-center justify-center gap-2 py-6 text-xs text-muted-foreground">
            <Loader2 className="size-3.5 animate-spin" />
            Loading messages…
          </div>
        ) : messages.length === 0 ? (
          <p className="py-6 text-center text-xs text-muted-foreground">
            No texts with this client yet.
          </p>
        ) : (
          messages.map((message) =>
            message.kind === "system" ? (
              <ConversationSystemMessageNote
                key={String(message.id)}
                message={message}
                compact
              />
            ) : (
              <ConversationMessageBubble
                key={String(message.id)}
                message={message}
                isOwn={message.direction === "outbound"}
                compact
              />
            ),
          )
        )}
      </div>

      <ClientSmsComposer
        contact={contact}
        dealId={record.id}
        conversationId={conversation?.id}
        disabled={!canSendMessages}
        compact
        onSent={({ conversation: nextConversation }) => {
          setConversation(nextConversation);
        }}
      />
    </div>
  );
};
