import {
  useCallback,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { useLocation } from "react-router";
import { useNotify, type Identifier } from "ra-core";
import type { ClientSmsDraft, Contact, Conversation } from "@/lbs/types";
import { MessagesDock } from "@/lbs/messages/MessagesDock";
import { MessagesNotificationsLayer } from "@/lbs/messages/MessagesNotificationsLayer";
import { useOpenClientSms } from "@/lbs/messages/useClientSms";
import {
  MessagesQuickAccessContext,
  type MessagesQuickAccessContextValue,
} from "@/lbs/messages/messagesQuickAccessContext";
import { setLocalLastRead, getLocalLastReadMap } from "@/lbs/messages/messagesReadStorage";

export {
  useMessagesQuickAccess,
  useMessagesQuickAccessOptional,
} from "@/lbs/messages/messagesQuickAccessContext";

export const MessagesQuickAccessProvider = ({ children }: { children: ReactNode }) => {
  const notify = useNotify();
  const location = useLocation();
  const { findClientConversation } = useOpenClientSms();
  const [isOpening, setIsOpening] = useState(false);
  const [isDockOpen, setIsDockOpen] = useState(false);
  const [focusedConversation, setFocusedConversation] = useState<Conversation | null>(null);
  const [draftSms, setDraftSms] = useState<ClientSmsDraft | null>(null);
  const [activeConversationId, setActiveConversationId] = useState<Identifier | null>(null);
  const [localReadVersion, setLocalReadVersion] = useState(0);

  const markConversationRead = useCallback((conversationId: Identifier, readAt?: string) => {
    const nextReadAt = readAt ?? new Date().toISOString();
    const key = String(conversationId);
    const currentReadAt = getLocalLastReadMap()[key];
    if (currentReadAt && Date.parse(nextReadAt) <= Date.parse(currentReadAt)) {
      return;
    }
    setLocalLastRead(conversationId, nextReadAt);
    setLocalReadVersion((current) => current + 1);
  }, []);

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
        notify(error instanceof Error ? error.message : "Failed to open SMS conversation", {
          type: "error",
        });
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
      localReadVersion,
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
      localReadVersion,
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
