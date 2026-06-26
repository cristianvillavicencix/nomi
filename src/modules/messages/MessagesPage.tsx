import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useDataProvider, useGetIdentity } from "ra-core";
import { useQueryClient } from "@tanstack/react-query";
import { useSearchParams } from "react-router";
import { PageLayout } from "@/components/atomic-crm/layout/page-shell";
import { useIsMobile } from "@/hooks/use-mobile";
import type { CrmDataProvider } from "@/components/atomic-crm/providers/types";
import type { Contact, Conversation } from "@/modules/types";
import { MessagesWorkspace } from "@/modules/messages/MessagesWorkspace";
import { INBOX_PAGE_SIZE } from "@/modules/messages/inbox/MessagesInbox";
import { useInboxConversations } from "@/modules/messages/useInboxConversations";
import { useMessagesQuickAccess } from "@/modules/messages/messagesQuickAccessContext";
import { requestMessagingDesktopNotifications } from "@/modules/messages/messagingDesktopNotifications";
import {
  MESSAGES_CONVERSATION_PARAM,
  parseMessagesConversationId,
} from "@/modules/messages/messagesRouting";

export const MessagesPage = () => {
  const isMobile = useIsMobile();
  const dataProvider = useDataProvider<CrmDataProvider>();
  const queryClient = useQueryClient();
  const { identity } = useGetIdentity();
  const [searchParams, setSearchParams] = useSearchParams();
  const deepLinkConversationId = parseMessagesConversationId(searchParams);
  const resolvingDeepLinkRef = useRef<string | null>(null);
  const [inboxPageSize, setInboxPageSize] = useState(INBOX_PAGE_SIZE);
  const [loadingMoreInbox, setLoadingMoreInbox] = useState(false);
  const {
    focusedConversation,
    clearFocusedConversation,
    draftSms,
    clearDraftSms,
    setDraftSms,
    focusConversation,
    setActiveConversationId,
    viewConversation,
  } = useMessagesQuickAccess();
  const [selectedConversation, setSelectedConversation] =
    useState<Conversation | null>(null);
  const [mobileShowChat, setMobileShowChat] = useState(false);

  const { conversations, deals, dmParticipants, members, contacts, isPending } =
    useInboxConversations({ pageSize: inboxPageSize });

  useEffect(() => {
    void queryClient.invalidateQueries({ queryKey: ["messaging-settings"] });
  }, [queryClient]);

  const clearConversationDeepLink = useCallback(() => {
    if (!searchParams.has(MESSAGES_CONVERSATION_PARAM)) return;
    const next = new URLSearchParams(searchParams);
    next.delete(MESSAGES_CONVERSATION_PARAM);
    setSearchParams(next, { replace: true });
  }, [searchParams, setSearchParams]);

  const openConversation = useCallback(
    (conversation: Conversation) => {
      clearDraftSms();
      viewConversation(conversation);
      focusConversation(conversation);
      setSelectedConversation(conversation);
      if (isMobile) setMobileShowChat(true);
    },
    [clearDraftSms, focusConversation, isMobile, viewConversation],
  );

  useEffect(() => {
    if (!deepLinkConversationId) {
      resolvingDeepLinkRef.current = null;
      return;
    }

    if (resolvingDeepLinkRef.current === deepLinkConversationId) {
      return;
    }

    const inList = conversations.find(
      (entry) => String(entry.id) === deepLinkConversationId,
    );
    if (inList) {
      resolvingDeepLinkRef.current = deepLinkConversationId;
      openConversation(inList);
      clearConversationDeepLink();
      return;
    }

    if (isPending) return;

    resolvingDeepLinkRef.current = deepLinkConversationId;
    let cancelled = false;

    void dataProvider
      .getOne<Conversation>("conversations", { id: deepLinkConversationId })
      .then(({ data }) => {
        if (cancelled || !data?.id) return;
        openConversation(data);
        clearConversationDeepLink();
      })
      .catch(() => {
        resolvingDeepLinkRef.current = null;
      });

    return () => {
      cancelled = true;
    };
  }, [
    clearConversationDeepLink,
    conversations,
    dataProvider,
    deepLinkConversationId,
    isPending,
    openConversation,
  ]);

  useEffect(() => {
    if (typeof Notification === "undefined") return;
    if (Notification.permission !== "default") return;
    const timer = window.setTimeout(() => {
      void requestMessagingDesktopNotifications();
    }, 2000);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (!focusedConversation) return;
    viewConversation(focusedConversation);
    setSelectedConversation(focusedConversation);
    if (isMobile) setMobileShowChat(true);
    clearFocusedConversation();
  }, [
    clearFocusedConversation,
    focusedConversation,
    isMobile,
    viewConversation,
  ]);

  useEffect(() => {
    if (!draftSms) return;
    setSelectedConversation(null);
    setActiveConversationId(null);
    if (isMobile) setMobileShowChat(true);
  }, [draftSms, isMobile, setActiveConversationId]);

  useEffect(() => {
    if (draftSms || selectedConversation) return;
    if (deepLinkConversationId) return;
    if (conversations[0]) {
      viewConversation(conversations[0]);
      setSelectedConversation(conversations[0]);
    }
  }, [
    conversations,
    deepLinkConversationId,
    draftSms,
    selectedConversation,
    viewConversation,
  ]);

  const handleSelectConversation = (conversation: Conversation) => {
    clearConversationDeepLink();
    openConversation(conversation);
  };

  const handleClientSmsSent = (conversation: Conversation) => {
    clearDraftSms();
    viewConversation(conversation);
    focusConversation(conversation);
    setSelectedConversation(conversation);
    if (isMobile) setMobileShowChat(true);
  };

  const handleClientSmsPhoneChange = useCallback(
    async (phone: string) => {
      if (draftSms && !draftSms.contact) {
        setDraftSms({ ...draftSms, externalPhone: phone });
        return;
      }

      const contact =
        draftSms?.contact ??
        (selectedConversation?.contact_id != null
          ? contacts.find(
              (entry) =>
                String(entry.id) === String(selectedConversation.contact_id),
            )
          : undefined);
      if (!contact) return;

      if (
        selectedConversation?.type === "client" &&
        selectedConversation.external_phone === phone
      ) {
        return;
      }

      const existing = await dataProvider.findClientConversationForContact(
        contact.id,
        phone,
      );
      if (existing?.last_message_at) {
        handleSelectConversation(existing);
        return;
      }

      setDraftSms({
        contact,
        dealId: selectedConversation?.deal_id ?? draftSms?.dealId ?? null,
        externalPhone: phone,
      });
      setSelectedConversation(null);
      setActiveConversationId(null);
    },
    [
      contacts,
      dataProvider,
      draftSms,
      selectedConversation,
      setActiveConversationId,
      setDraftSms,
    ],
  );

  const handleClientSmsContactSaved = useCallback(
    (contact: Contact) => {
      if (draftSms) {
        setDraftSms({ ...draftSms, contact });
        return;
      }
      if (selectedConversation) {
        setSelectedConversation({
          ...selectedConversation,
          contact_id: contact.id,
        });
      }
    },
    [draftSms, selectedConversation, setDraftSms],
  );

  return (
    <PageLayout className="flex h-full min-h-0 flex-col overflow-hidden rounded-xl border border-border/40 bg-background shadow-sm">
      <MessagesWorkspace
        conversations={conversations}
        deals={deals}
        dmParticipants={dmParticipants}
        members={members}
        contacts={contacts}
        currentMemberId={identity?.id}
        selectedConversation={selectedConversation}
        clientSmsDraft={draftSms}
        onSelectConversation={handleSelectConversation}
        onClientSmsSent={handleClientSmsSent}
        onClientSmsPhoneChange={(phone) =>
          void handleClientSmsPhoneChange(phone)
        }
        onClientSmsContactSaved={handleClientSmsContactSaved}
        isPending={isPending}
        isMobile={isMobile}
        showMobileChat={mobileShowChat}
        onMobileBack={() => setMobileShowChat(false)}
        className="min-h-0 flex-1"
        onLoadMoreInbox={() => {
          setLoadingMoreInbox(true);
          setInboxPageSize((current) => current + INBOX_PAGE_SIZE);
          setTimeout(() => setLoadingMoreInbox(false), 300);
        }}
        hasMoreInbox={conversations.length >= inboxPageSize}
        loadingMoreInbox={loadingMoreInbox}
      />
    </PageLayout>
  );
};
