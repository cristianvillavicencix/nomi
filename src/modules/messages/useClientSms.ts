import { useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useDataProvider, type Identifier } from "ra-core";
import type {
  Contact,
  Conversation,
  ConversationMessage,
} from "@/modules/types";
import type { CrmDataProvider } from "@/components/atomic-crm/providers/types";
import { contactHasSmsPhone } from "@/modules/messages/messageContactUtils";
import { normalizeUsPhoneToE164 } from "@/utils/phone";
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

  const findClientConversationByPhone = useCallback(
    async (phone: string): Promise<Conversation | null> => {
      const normalized = normalizeUsPhoneToE164(phone);
      if (!normalized) {
        throw new Error("Enter a valid US phone number");
      }
      return dataProvider.findClientConversationByPhone(normalized);
    },
    [dataProvider],
  );

  return { findClientConversation, findClientConversationByPhone };
};

export const useSendClientSms = () => {
  const dataProvider = useDataProvider<CrmDataProvider>();
  const queryClient = useQueryClient();

  return useCallback(
    async (params: {
      conversationId?: Identifier;
      contactId?: Identifier;
      dealId?: Identifier | null;
      body?: string;
      mediaUrls?: string[];
      isInternalNote?: boolean;
      templateId?: Identifier;
      replyToMessageId?: Identifier | null;
      externalPhone?: string | null;
      resendMessageId?: Identifier;
    }) => {
      const result = await dataProvider.sendClientSms({
        conversationId: params.conversationId,
        contactId: params.contactId,
        dealId: params.dealId,
        body: params.body ?? "",
        mediaUrls: params.mediaUrls,
        isInternalNote: params.isInternalNote,
        templateId: params.templateId,
        replyToMessageId: params.replyToMessageId,
        externalPhone: params.externalPhone,
        resendMessageId: params.resendMessageId,
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
