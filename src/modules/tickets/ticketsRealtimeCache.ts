import type { QueryClient } from "@tanstack/react-query";
import type { TicketMessage } from "@/modules/types";

type MessageListCache = {
  data: TicketMessage[];
  total: number;
  pageInfo?: { hasNextPage?: boolean; hasPreviousPage?: boolean };
  meta?: unknown;
};

const getTicketMessagesQueryKey = (ticketId: string) =>
  [
    "ticket_messages",
    "getList",
    {
      pagination: { page: 1, perPage: 500 },
      sort: { field: "created_at", order: "DESC" },
      filter: { "ticket_id@eq": ticketId },
      meta: undefined,
    },
  ] as const;

const mergeMessageIntoList = (
  old: MessageListCache | undefined,
  message: TicketMessage,
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

  // Newest-first thread: new messages go to the top.
  return {
    ...old,
    data: [message, ...old.data],
    total: old.total + 1,
  };
};

export const appendTicketMessageToCache = (
  queryClient: QueryClient,
  message: TicketMessage,
) => {
  if (message.ticket_id == null) return;
  const ticketId = String(message.ticket_id);

  queryClient.setQueryData<MessageListCache>(
    getTicketMessagesQueryKey(ticketId),
    (old) => mergeMessageIntoList(old, message),
  );

  queryClient.setQueriesData<MessageListCache>(
    {
      queryKey: ["ticket_messages", "getList"],
      predicate: (query) => {
        const params = query.queryKey[2] as
          | { filter?: Record<string, unknown> }
          | undefined;
        return params?.filter?.["ticket_id@eq"] === ticketId;
      },
    },
    (old) => mergeMessageIntoList(old, message),
  );
};

export const refreshTicketInboxLists = (queryClient: QueryClient) => {
  void queryClient.invalidateQueries({
    queryKey: ["tickets"],
    refetchType: "all",
  });
  void queryClient.invalidateQueries({
    queryKey: ["tickets-unread-counts"],
    refetchType: "all",
  });
};
