import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import {
  useDataProvider,
  useGetIdentity,
  useNotify,
} from "ra-core";
import type { Contact } from "@/components/atomic-crm/types";
import type { CrmDataProvider } from "@/components/atomic-crm/providers/types";
import { useConfigurationContext } from "@/components/atomic-crm/root/ConfigurationContext";
import { useMemberCapability } from "@/components/atomic-crm/providers/commons/useMemberCapability";
import { formatInvoiceDueDate } from "@/modules/billing/invoiceEmailTemplate";
import { resolveInvoiceOrganizationName } from "@/modules/billing/invoiceOrganizationInfo";
import type { ClientInvoice, Conversation, Ticket, TicketDeliverable } from "@/modules/types";
import { getDeliverablesForInvoice } from "@/modules/tickets/ticketInvoiceTabs";
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
import {
  buildTicketDeliverySmsText,
  buildTicketPaymentReminderSmsText,
  buildTicketPaymentSmsText,
  buildTicketPaymentThankYouSmsText,
  formatTicketInvoicePreviewMoney,
} from "@/modules/tickets/ticketInvoicePreview";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type TicketToolsClientSmsProps = {
  ticket: Ticket;
  contact?: Contact | null;
  activeInvoice?: ClientInvoice | null;
  deliverables?: TicketDeliverable[];
  className?: string;
};

const QUICK_ACTION_BUTTON_CLASS =
  "h-7 rounded-none border-border text-[11px] px-2.5";

export const TicketToolsClientSms = ({
  ticket,
  contact,
  activeInvoice,
  deliverables = [],
  className,
}: TicketToolsClientSmsProps) => {
  const notify = useNotify();
  const dataProvider = useDataProvider<CrmDataProvider>();
  const { identity } = useGetIdentity();
  const { title, companyLegalName } = useConfigurationContext();
  const { smsEnabled, isPending: messagingPending } = useMessagingEnabled();
  const canSendMessages = useMemberCapability("messaging.send");
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const [conversation, setConversation] = useState<Conversation | null>(null);
  const [composerPrefill, setComposerPrefill] = useState<{
    key: number;
    text: string;
  } | null>(null);

  const organizationName = useMemo(
    () => resolveInvoiceOrganizationName({ title, companyLegalName }),
    [title, companyLegalName],
  );

  const senderFirstName = useMemo(() => {
    const name =
      identity?.fullName ||
      [identity?.first_name, identity?.last_name].filter(Boolean).join(" ");
    return name?.split(/\s+/)[0] ?? null;
  }, [identity]);

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

  const canUseQuickActions =
    activeInvoice?.status === "sent" || activeInvoice?.status === "paid";

  const { data: shareLink } = useQuery({
    queryKey: ["ticket-sms-share", activeInvoice?.id],
    queryFn: () =>
      dataProvider.shareClientInvoice({
        invoiceId: activeInvoice!.id,
        baseUrl: window.location.origin,
      }),
    enabled: Boolean(activeInvoice?.id && canUseQuickActions),
    staleTime: 60_000,
  });

  const paymentUrl = useMemo(() => {
    if (!shareLink) return "";
    if (shareLink.short_code?.trim()) {
      return `${window.location.origin.replace(/\/$/, "")}/iv/${shareLink.short_code}?sms=1`;
    }
    if (shareLink.short_url?.trim()) return shareLink.short_url;
    if (shareLink.url?.trim()) return shareLink.url;
    return "";
  }, [shareLink]);

  const activeInvoiceFileNames = useMemo(() => {
    if (!activeInvoice?.id) return [];
    return getDeliverablesForInvoice(deliverables, activeInvoice.id).map(
      (file) => file.title,
    );
  }, [activeInvoice?.id, deliverables]);

  const prefillComposer = (text: string | null) => {
    if (!text) {
      notify("Payment link is not ready yet", { type: "warning" });
      return;
    }
    setComposerPrefill({ key: Date.now(), text });
  };

  const quickActions = useMemo(() => {
    if (!canUseQuickActions || !activeInvoice) return [];

    if (activeInvoice.status === "paid") {
      const thankYou = buildTicketPaymentThankYouSmsText({
        orgName: organizationName,
        ticket,
        contact,
        invoiceNumber: activeInvoice.invoice_number,
        amountFormatted: formatTicketInvoicePreviewMoney(
          Number(activeInvoice.amount) || 0,
        ),
      });
      const filesDelivered = buildTicketDeliverySmsText({
        orgName: organizationName,
        ticket,
        contact,
        invoiceNumber: activeInvoice.invoice_number,
        fileNames: activeInvoiceFileNames,
      });

      return [
        {
          key: "thank-you",
          label: "Payment received",
          disabled: false,
          onClick: () => prefillComposer(thankYou),
        },
        {
          key: "files-delivered",
          label: "Files delivered",
          disabled: activeInvoiceFileNames.length === 0,
          onClick: () => prefillComposer(filesDelivered),
        },
      ];
    }

    if (activeInvoice.status === "sent") {
      const payLink =
        activeInvoice && paymentUrl
          ? buildTicketPaymentSmsText({
              orgName: organizationName,
              invoiceNumber: activeInvoice.invoice_number,
              amountFormatted: formatTicketInvoicePreviewMoney(
                Number(activeInvoice.amount) || 0,
              ),
              dueDateFormatted: formatInvoiceDueDate(activeInvoice.due_date),
              paymentUrl,
              contact,
              senderFirstName,
            })
          : null;
      const reminder =
        activeInvoice && paymentUrl
          ? buildTicketPaymentReminderSmsText({
              orgName: organizationName,
              invoiceNumber: activeInvoice.invoice_number,
              amountFormatted: formatTicketInvoicePreviewMoney(
                Number(activeInvoice.amount) || 0,
              ),
              dueDateFormatted: formatInvoiceDueDate(activeInvoice.due_date),
              paymentUrl,
              contact,
              senderFirstName,
            })
          : null;

      return [
        {
          key: "resend-link",
          label: "Resend pay link",
          disabled: !paymentUrl,
          onClick: () => prefillComposer(payLink),
        },
        {
          key: "reminder",
          label: "Payment reminder",
          disabled: !paymentUrl,
          onClick: () => prefillComposer(reminder),
        },
      ];
    }

    return [];
  }, [
    activeInvoice,
    activeInvoiceFileNames,
    canUseQuickActions,
    contact,
    organizationName,
    paymentUrl,
    senderFirstName,
    ticket,
  ]);

  useEffect(() => {
    const node = scrollRef.current;
    if (!node) return;
    node.scrollTop = node.scrollHeight;
  }, [messages.length, conversation?.id]);

  const isLoadingMessages =
    conversationPending || (conversation?.id != null && messagesPending);

  const renderEmptyState = (message: string) => (
    <div className={cn("px-4 pb-4", className)}>
      <p className="text-xs text-muted-foreground">{message}</p>
    </div>
  );

  if (!contact) {
    return renderEmptyState(
      "Link a contact on this ticket to text the client.",
    );
  }

  if (messagingPending) {
    return (
      <div className={cn("flex items-center gap-2 px-4 py-4 text-xs text-muted-foreground", className)}>
        <Loader2 className="size-3.5 animate-spin" />
        Loading messaging…
      </div>
    );
  }

  if (!smsEnabled) {
    return renderEmptyState(
      "SMS is not enabled. Turn it on in Settings → Messaging.",
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

  return (
    <div className={cn("flex min-h-0 flex-1 flex-col", className)}>
      <div className="flex items-center gap-2.5 border-b border-border/70 px-3 py-2">
        <Avatar className="size-8 rounded-full">
          <AvatarFallback className="rounded-full bg-sky-100 text-xs font-medium text-sky-800">
            {getInitials(clientName)}
          </AvatarFallback>
        </Avatar>
        <div className="min-w-0">
          <p className="truncate text-xs font-medium">{clientName}</p>
          <p className="truncate text-[11px] text-muted-foreground">{phoneLabel}</p>
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

      {quickActions.length > 0 ? (
        <div className="flex flex-wrap gap-1.5 border-t border-border/70 px-3 py-2">
          {quickActions.map((action) => (
            <Button
              key={action.key}
              type="button"
              variant="outline"
              size="sm"
              className={QUICK_ACTION_BUTTON_CLASS}
              disabled={action.disabled}
              onClick={action.onClick}
            >
              {action.label}
            </Button>
          ))}
        </div>
      ) : null}

      <ClientSmsComposer
        contact={contact}
        dealId={ticket.deal_id ?? undefined}
        conversationId={conversation?.id}
        disabled={!canSendMessages}
        prefillRequest={composerPrefill}
        composerShape="square"
        compact
        onSent={({ conversation: nextConversation }) => {
          setConversation(nextConversation);
        }}
      />
    </div>
  );
};
