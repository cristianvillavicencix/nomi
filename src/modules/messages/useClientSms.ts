import { useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useDataProvider, type Identifier } from "ra-core";
import type { Contact, Conversation, ConversationMessage } from "@/modules/types";
import type { CrmDataProvider } from "@/components/atomic-crm/providers/types";
import { contactHasSmsPhone } from "@/modules/messages/messageContactUtils";
import {
  appendConversationMessageToCache,
  refreshConversationLists,
} from "@/modules/messages/messagesRealtimeCache";

export const useOpenClientSms = () => {
  const dataProvider = useDataProvider<CrmDataProvider>();

  const findClientConversation = useCallback(
    async (
      contact: Contact,
      externalPhone?: string | null,
    ): Promise<Conversation | null> => {
      if (!contactHasSmsPhone(contact)) {
        throw new Error("This contact has no valid phone number");
      }
      return dataProvider.findClientConversationForContact(
        contact.id,
        externalPhone,
      );
    },
    [dataProvider],
  );

  return { findClientConversation };
};

export const useSendClientSms = () => {
  const dataProvider = useDataProvider<CrmDataProvider>();
  const queryClient = useQueryClient();

  return useCallback(
    async (params: {
      conversationId?: Identifier;
      contactId?: Identifier;
      dealId?: Identifier | null;
      body: string;
      mediaUrls?: string[];
      isInternalNote?: boolean;
      templateId?: Identifier;
      replyToMessageId?: Identifier | null;
      externalPhone?: string | null;
    }) => {
      const result = await dataProvider.sendClientSms({
        conversationId: params.conversationId,
        contactId: params.contactId,
        dealId: params.dealId,
        body: params.body,
        mediaUrls: params.mediaUrls,
        isInternalNote: params.isInternalNote,
        templateId: params.templateId,
        replyToMessageId: params.replyToMessageId,
        externalPhone: params.externalPhone,
      });

      const message = result.message as ConversationMessage | null;
      if (message) {
        appendConversationMessageToCache(queryClient, message);
      }
      refreshConversationLists(queryClient);

      return {
        message,
        conversation: result.conversation as Conversation | null,
      };
    },
    [dataProvider, queryClient],
  );
};
