import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { useLocation } from "react-router";
import {
  useDataProvider,
  useGetIdentity,
  useNotify,
  type Identifier,
} from "ra-core";
import { useQueryClient } from "@tanstack/react-query";
import type { ClientSmsDraft, Contact, Conversation } from "@/lbs/types";
import { MessagesDock } from "@/lbs/messages/MessagesDock";
import { MessagesNotificationsLayer } from "@/lbs/messages/MessagesNotificationsLayer";
import { persistConversationRead } from "@/lbs/messages/persistConversationRead";
import { useOpenClientSms } from "@/lbs/messages/useClientSms";
import { primeAudioContext } from "@/lbs/messages/messageNotificationSound";
import {
  MessagesQuickAccessContext,
  type MessagesQuickAccessContextValue,
} from "@/lbs/messages/messagesQuickAccessContext";

export {
  useMessagesQuickAccess,
  useMessagesQuickAccessOptional,
} from "@/lbs/messages/messagesQuickAccessContext";

export const MessagesQuickAccessProvider = ({
  children,
}: {
  children: ReactNode;
}) => {
  const notify = useNotify();
  const location = useLocation();
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
      primeAudioContext();
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
      });
    },
    [dataProvider, identity?.id, queryClient],
  );

  const viewConversation = useCallback(
    (conversation: Conversation) => {
      setActiveConversationId((current) =>
        String(current) === String(conversation.id) ? current : conversation.id,
      );
      markConversationRead(
        conversation.id,
        conversation.last_message_at ?? new Date().toISOString(),
      );
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
        setIsDockOpen(true);
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
    [findClientConversation, location.pathname, notify, viewConversation],
  );

  const openInbox = useCallback(() => {
    setIsDockOpen(true);
  }, []);

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
      toggleInbox,
      viewConversation,
    ],
  );

  return (
    <MessagesQuickAccessContext.Provider value={value}>
      {children}
      <MessagesNotificationsLayer />
      <MessagesDock />
    </MessagesQuickAccessContext.Provider>
  );
};
