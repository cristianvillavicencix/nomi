import type { QueryClient } from "@tanstack/react-query";
import type { Identifier } from "ra-core";
import type { Conversation, ConversationMessage } from "@/lbs/types";
import { buildMessagePreview } from "@/lbs/messages/conversationUtils";

export const CONVERSATION_MESSAGES_PAGE_SIZE = 50;

type MessageListCache = {
  data: ConversationMessage[];
  total: number;
  pageInfo?: { hasNextPage?: boolean; hasPreviousPage?: boolean };
  meta?: unknown;
};

const CONVERSATION_MESSAGES_LIST_PARAMS = {
  pagination: { page: 1, perPage: CONVERSATION_MESSAGES_PAGE_SIZE },
  sort: { field: "created_at", order: "DESC" as const },
};

export const getConversationMessagesQueryKey = (conversationId: Identifier) =>
  [
    "conversation_messages",
    "getList",
    {
      ...CONVERSATION_MESSAGES_LIST_PARAMS,
      filter: { "conversation_id@eq": conversationId },
      meta: undefined,
    },
  ] as const;

const getConversationFilterId = (queryKey: readonly unknown[]) => {
  if (queryKey.length < 3) return null;
  const params = queryKey[2] as { filter?: Record<string, unknown> };
  const filterId = params?.filter?.["conversation_id@eq"];
  return filterId == null ? null : String(filterId);
};

const getManyIncludesConversation = (
  queryKey: readonly unknown[],
  conversationId: string,
) => {
  if (queryKey.length < 3) return false;
  const params = queryKey[2] as { ids?: string[] } | undefined;
  return params?.ids?.some((id) => String(id) === conversationId) ?? false;
};

const mergeMessageIntoList = (
  old: MessageListCache | undefined,
  message: ConversationMessage,
): MessageListCache => {
  if (!old) {
    return { data: [message], total: 1 };
  }

  const messageId = String(message.id);
  const existingIndex = old.data.findIndex(
    (entry) => String(entry.id) === messageId,
  );

  if (existingIndex >= 0) {
    const nextData = [...old.data];
    nextData[existingIndex] = { ...nextData[existingIndex], ...message };
    return { ...old, data: nextData };
  }

  return {
    ...old,
    data: [message, ...old.data],
    total: old.total + 1,
  };
};

export { mergeMessageIntoList };

const patchConversationInList = (
  conversation: Conversation,
  message: ConversationMessage,
): Conversation => ({
  ...conversation,
  last_message_at: message.created_at ?? conversation.last_message_at,
  last_message_preview: buildMessagePreview(message),
});

const touchConversationLists = (
  queryClient: QueryClient,
  message: ConversationMessage,
) => {
  if (message.conversation_id == null) return;
  const conversationId = String(message.conversation_id);

  queryClient.setQueriesData<{ data: Conversation[] }>(
    { queryKey: ["conversations"] },
    (old) => {
      if (!old?.data?.length) return old;
      let changed = false;
      const data = old.data.map((conversation) => {
        if (String(conversation.id) !== conversationId) return conversation;
        changed = true;
        return patchConversationInList(conversation, message);
      });
      return changed ? { ...old, data } : old;
    },
  );

  queryClient.setQueriesData<Conversation[]>(
    {
      queryKey: ["conversations", "getMany"],
      predicate: (query) =>
        getManyIncludesConversation(query.queryKey, conversationId),
    },
    (old) => {
      if (!old?.length) return old;
      let changed = false;
      const data = old.map((conversation) => {
        if (String(conversation.id) !== conversationId) return conversation;
        changed = true;
        return patchConversationInList(conversation, message);
      });
      return changed ? data : old;
    },
  );
};

export const appendConversationMessageToCache = (
  queryClient: QueryClient,
  message: ConversationMessage,
) => {
  if (message.conversation_id == null) return;

  const conversationId = String(message.conversation_id);

  queryClient.setQueryData<MessageListCache>(
    getConversationMessagesQueryKey(message.conversation_id),
    (old) => mergeMessageIntoList(old, message),
  );

  queryClient.setQueriesData<MessageListCache>(
    {
      queryKey: ["conversation_messages", "getList"],
      predicate: (query) =>
        getConversationFilterId(query.queryKey) === conversationId,
    },
    (old) => mergeMessageIntoList(old, message),
  );

  touchConversationLists(queryClient, message);
};

export const refreshConversationLists = (queryClient: QueryClient) => {
  void queryClient.invalidateQueries({ queryKey: ["conversations"] });
  void queryClient.invalidateQueries({ queryKey: ["conversation_messages"] });
};
