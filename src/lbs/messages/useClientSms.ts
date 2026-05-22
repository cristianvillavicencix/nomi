import { useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useDataProvider, useGetIdentity, type Identifier } from "ra-core";
import type { Contact, Conversation, ConversationMessage } from "@/lbs/types";
import type { CrmDataProvider } from "@/components/atomic-crm/providers/types";
import { contactHasSmsPhone } from "@/lbs/messages/messageContactUtils";
import {
  appendConversationMessageToCache,
  refreshConversationLists,
} from "@/lbs/messages/messagesRealtimeCache";

export const useOpenClientSms = () => {
  const dataProvider = useDataProvider<CrmDataProvider>();
  const { identity } = useGetIdentity();

  const findClientConversation = useCallback(
    async (contact: Contact): Promise<Conversation | null> => {
      if (!contactHasSmsPhone(contact)) {
        throw new Error("This contact has no valid phone number");
      }
      return dataProvider.findClientConversationForContact(contact.id);
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
    }) => {
      const result = await dataProvider.sendClientSms({
        conversationId: params.conversationId,
        contactId: params.contactId,
        dealId: params.dealId,
        body: params.body,
        mediaUrls: params.mediaUrls,
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
