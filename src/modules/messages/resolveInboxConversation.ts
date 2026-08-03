import type { CrmDataProvider } from "@/components/atomic-crm/providers/types";
import type { Conversation } from "@/modules/types";

/** Project team chats are hidden from the inbox; open the client SMS thread instead. */
export const resolveInboxConversation = async (
  conversation: Conversation,
  dataProvider: CrmDataProvider,
): Promise<Conversation> => {
  if (conversation.type !== "project") {
    return conversation;
  }

  let contactId = conversation.contact_id ?? null;
  if (contactId == null && conversation.deal_id != null) {
    try {
      const { data: deal } = await dataProvider.getOne("deals", {
        id: conversation.deal_id,
      });
      contactId = deal?.contact_id ?? null;
    } catch {
      return conversation;
    }
  }

  if (contactId == null) {
    return conversation;
  }

  try {
    const clientConversation =
      await dataProvider.findClientConversationForContact(contactId);
    if (clientConversation?.last_message_at) {
      return clientConversation;
    }
  } catch {
    return conversation;
  }

  return conversation;
};
