import type { DataProvider, Identifier } from "ra-core";
import type { QueryClient } from "@tanstack/react-query";
import type { ConversationParticipant } from "@/lbs/types";

export const isReadThrough = (
  readAt: string | null | undefined,
  targetAt: string,
) => {
  if (!readAt) return false;
  return Date.parse(targetAt) <= Date.parse(readAt);
};

const patchParticipantReadAtInCache = (
  queryClient: QueryClient,
  conversationId: Identifier,
  memberId: Identifier,
  readAt: string,
) => {
  queryClient.setQueriesData<{ data: ConversationParticipant[] }>(
    { queryKey: ["conversation_participants", "getList"] },
    (old) => {
      if (!old?.data) return old;

      const existingIndex = old.data.findIndex(
        (entry) =>
          String(entry.conversation_id) === String(conversationId) &&
          String(entry.member_id) === String(memberId),
      );

      if (existingIndex >= 0) {
        const nextData = [...old.data];
        nextData[existingIndex] = {
          ...nextData[existingIndex],
          last_read_at: readAt,
        };
        return { ...old, data: nextData };
      }

      return {
        ...old,
        data: [
          ...old.data,
          {
            id: `optimistic-read-${conversationId}-${memberId}`,
            conversation_id: conversationId,
            member_id: memberId,
            last_read_at: readAt,
          } as ConversationParticipant,
        ],
      };
    },
  );
};

export const persistConversationRead = async ({
  dataProvider,
  queryClient,
  conversationId,
  memberId,
  readAt,
}: {
  dataProvider: DataProvider;
  queryClient: QueryClient;
  conversationId: Identifier;
  memberId: Identifier;
  readAt: string;
}) => {
  patchParticipantReadAtInCache(
    queryClient,
    conversationId,
    memberId,
    readAt,
  );

  const { data: participants } =
    await dataProvider.getList<ConversationParticipant>(
      "conversation_participants",
      {
        filter: {
          "conversation_id@eq": conversationId,
          "member_id@eq": memberId,
        },
        pagination: { page: 1, perPage: 1 },
      },
    );

  const participant = participants[0];

  if (
    participant?.last_read_at &&
    isReadThrough(participant.last_read_at, readAt)
  ) {
    return false;
  }

  try {
    if (participant?.id) {
      await dataProvider.update("conversation_participants", {
        id: participant.id,
        data: { last_read_at: readAt },
        previousData: participant,
      });
    } else {
      await dataProvider.create("conversation_participants", {
        data: {
          conversation_id: conversationId,
          member_id: memberId,
          last_read_at: readAt,
        },
      });
    }
  } catch (error) {
    await queryClient.invalidateQueries({
      queryKey: ["conversation_participants"],
    });
    throw error;
  }

  await queryClient.invalidateQueries({
    queryKey: ["conversation_participants"],
  });
  void queryClient.invalidateQueries({
    queryKey: ["conversations-unread-counts"],
  });
  return true;
};
