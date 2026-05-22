import type { QueryClient } from "@tanstack/react-query";
import type { Identifier } from "ra-core";
import type { ConversationMessage } from "@/lbs/types";

type MessageListCache = {
  data: ConversationMessage[];
  total: number;
  pageInfo?: { hasNextPage?: boolean; hasPreviousPage?: boolean };
  meta?: unknown;
};

const CONVERSATION_MESSAGES_LIST_PARAMS = {
  pagination: { page: 1, perPage: 300 },
  sort: { field: "created_at", order: "ASC" as const },
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

const mergeMessageIntoList = (
  old: MessageListCache | undefined,
  message: ConversationMessage,
): MessageListCache => {
  if (!old) {
    return { data: [message], total: 1 };
  }
  if (old.data.some((entry) => String(entry.id) === String(message.id))) {
    return old;
  }
  return {
    ...old,
    data: [...old.data, message],
    total: old.total + 1,
  };
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
};

export const refreshConversationLists = (queryClient: QueryClient) => {
  void queryClient.invalidateQueries({ queryKey: ["conversations"] });
};
