import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { useLocation, useNavigate } from "react-router";
import {
  useDataProvider,
  useGetIdentity,
  useNotify,
  type Identifier,
} from "ra-core";
import { useQueryClient } from "@tanstack/react-query";
import type { ClientSmsDraft, Contact, Conversation } from "@/modules/types";
import { AppNotificationsLayer } from "@/modules/notifications/AppNotificationsLayer";
import { persistConversationRead } from "@/modules/messages/persistConversationRead";
import { useOpenClientSms } from "@/modules/messages/useClientSms";
import { primeNotificationAudioContext } from "@/lib/notificationSound";
import {
  MessagesQuickAccessContext,
  type MessagesQuickAccessContextValue,
} from "@/modules/messages/messagesQuickAccessContext";

export {
  useMessagesQuickAccess,
  useMessagesQuickAccessOptional,
} from "@/modules/messages/messagesQuickAccessContext";

export const MessagesQuickAccessProvider = ({
  children,
}: {
  children: ReactNode;
}) => {
  const notify = useNotify();
  const location = useLocation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const dataProvider = useDataProvider();
  const { identity } = useGetIdentity();
  const { findClientConversation } = useOpenClientSms();
  const [isOpening, setIsOpening] = useState(false);
  const [isDockOpen, setIsDockOpen] = useState(false);
  const [focusedConversation, setFocusedConversation] =
    useState<Conversation | null>(null);
  const [draftSms, setDraftSms] = useState<ClientSmsDraft | null>(null);
  const [activeConversationId, setActiveConversationId] =
    useState<Identifier | null>(null);

  useEffect(() => {
    const handler = () => {
      primeNotificationAudioContext();
      window.removeEventListener("click", handler);
      window.removeEventListener("keydown", handler);
    };
    window.addEventListener("click", handler);
    window.addEventListener("keydown", handler);
    return () => {
      window.removeEventListener("click", handler);
      window.removeEventListener("keydown", handler);
    };
  }, []);

  const markConversationRead = useCallback(
    (conversationId: Identifier, readAt?: string) => {
      if (!identity?.id) return;
      const timestamp = readAt ?? new Date().toISOString();
      void persistConversationRead({
        dataProvider,
        queryClient,
        conversationId,
        memberId: identity.id,
        readAt: timestamp,
      }).catch(() => {
        // Swallow — hook callers handle permission errors; duplicate reads are retried safely.
      });
    },
    [dataProvider, identity?.id, queryClient],
  );

  const viewConversation = useCallback(
    (conversation: Conversation) => {
      setActiveConversationId((current) =>
        String(current) === String(conversation.id) ? current : conversation.id,
      );
      const readAt = conversation.last_message_at
        ? new Date(
            Math.max(Date.parse(conversation.last_message_at), Date.now()),
          ).toISOString()
        : new Date().toISOString();
      markConversationRead(conversation.id, readAt);
    },
    [markConversationRead],
  );

  const clearFocusedConversation = useCallback(() => {
    setFocusedConversation(null);
  }, []);

  const clearDraftSms = useCallback(() => {
    setDraftSms(null);
  }, []);

  const focusConversation = useCallback(
    (conversation: Conversation) => {
      setDraftSms(null);
      setFocusedConversation(conversation);
      viewConversation(conversation);
    },
    [viewConversation],
  );

  const openSms = useCallback(
    async (nextContact: Contact, nextDealId?: Identifier | null) => {
      setIsOpening(true);
      setDraftSms(null);
      setFocusedConversation(null);

      if (!location.pathname.startsWith("/messages")) {
        navigate("/messages");
      }

      try {
        const existing = await findClientConversation(nextContact);
        if (existing?.last_message_at) {
          viewConversation(existing);
          setFocusedConversation(existing);
        } else {
          setDraftSms({ contact: nextContact, dealId: nextDealId ?? null });
        }
      } catch (error) {
        notify(
          error instanceof Error
            ? error.message
            : "Failed to open SMS conversation",
          {
            type: "error",
          },
        );
      } finally {
        setIsOpening(false);
      }
    },
    [findClientConversation, location.pathname, navigate, notify, viewConversation],
  );

  const openInbox = useCallback(() => {
    navigate("/messages");
  }, [navigate]);

  const closeInbox = useCallback(() => {
    setIsDockOpen(false);
    setDraftSms(null);
  }, []);

  const toggleInbox = useCallback(() => {
    setIsDockOpen((current) => !current);
  }, []);

  const value = useMemo<MessagesQuickAccessContextValue>(
    () => ({
      openSms,
      isOpening,
      isDockOpen,
      focusedConversation,
      draftSms,
      activeConversationId,
      clearFocusedConversation,
      setDraftSms,
      clearDraftSms,
      focusConversation,
      setActiveConversationId,
      markConversationRead,
      viewConversation,
      openInbox,
      closeInbox,
      toggleInbox,
    }),
    [
      activeConversationId,
      clearDraftSms,
      clearFocusedConversation,
      closeInbox,
      draftSms,
      focusConversation,
      focusedConversation,
      isDockOpen,
      isOpening,
      markConversationRead,
      openInbox,
      openSms,
      setDraftSms,
      toggleInbox,
      viewConversation,
    ],
  );

  return (
    <MessagesQuickAccessContext.Provider value={value}>
      {children}
      <AppNotificationsLayer />
    </MessagesQuickAccessContext.Provider>
  );
};
