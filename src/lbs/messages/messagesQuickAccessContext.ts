import { createContext, useContext } from "react";
import type { Identifier } from "ra-core";
import type { ClientSmsDraft, Contact, Conversation } from "@/lbs/types";

export type MessagesQuickAccessContextValue = {
  openSms: (contact: Contact, dealId?: Identifier | null) => Promise<void>;
  isOpening: boolean;
  isDockOpen: boolean;
  focusedConversation: Conversation | null;
  draftSms: ClientSmsDraft | null;
  activeConversationId: Identifier | null;
  clearFocusedConversation: () => void;
  clearDraftSms: () => void;
  focusConversation: (conversation: Conversation) => void;
  setActiveConversationId: (conversationId: Identifier | null) => void;
  markConversationRead: (conversationId: Identifier, readAt?: string) => void;
  viewConversation: (conversation: Conversation) => void;
  openInbox: () => void;
  closeInbox: () => void;
  toggleInbox: () => void;
};

export const MessagesQuickAccessContext =
  createContext<MessagesQuickAccessContextValue | null>(null);

export const useMessagesQuickAccess = () => {
  const context = useContext(MessagesQuickAccessContext);
  if (!context) {
    throw new Error(
      "useMessagesQuickAccess must be used within MessagesQuickAccessProvider",
    );
  }
  return context;
};

export const useMessagesQuickAccessOptional = () =>
  useContext(MessagesQuickAccessContext);
