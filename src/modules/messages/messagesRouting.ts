export const MESSAGES_CONVERSATION_PARAM = "conversation";

export const getMessagesConversationPath = (conversationId: string | number) =>
  `/messages?${MESSAGES_CONVERSATION_PARAM}=${conversationId}`;

export const parseMessagesConversationId = (
  searchParams: URLSearchParams,
): string | null => {
  const raw = searchParams.get(MESSAGES_CONVERSATION_PARAM)?.trim();
  return raw || null;
};
