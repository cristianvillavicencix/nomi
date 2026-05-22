import { useCallback } from "react";
import { useDataProvider, useGetIdentity, type Identifier } from "ra-core";
import type { Contact, Conversation } from "@/lbs/types";
import type { CrmDataProvider } from "@/components/atomic-crm/providers/types";

export const useOpenClientSms = () => {
  const dataProvider = useDataProvider<CrmDataProvider>();
  const { identity } = useGetIdentity();

  const openClientSms = useCallback(
    async (contact: Contact, dealId?: Identifier | null): Promise<Conversation> => {
      const currentMemberId = identity?.id;
      if (!currentMemberId) {
        throw new Error("Missing current member");
      }

      return dataProvider.ensureClientConversation({
        contactId: contact.id,
        authorMemberId: currentMemberId,
        dealId: dealId ?? null,
      });
    },
    [dataProvider, identity?.id],
  );

  return { openClientSms };
};

export const useSendClientSms = () => {
  const dataProvider = useDataProvider<CrmDataProvider>();

  return useCallback(
    async (conversationId: Identifier, body: string) => {
      return dataProvider.sendClientSms({
        conversationId,
        body,
      });
    },
    [dataProvider],
  );
};
