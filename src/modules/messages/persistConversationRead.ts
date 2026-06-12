import type { DataProvider, Identifier } from "ra-core";
import type { QueryClient } from "@tanstack/react-query";
import type { ConversationParticipant } from "@/modules/types";

export const isReadThrough = (
  readAt: string | null | undefined,
  targetAt: string,
) => {
  if (!readAt) return false;
  return Date.parse(targetAt) <= Date.parse(readAt);
};

const isPersistedParticipantId = (id: unknown) =>
  id != null && !String(id).startsWith("optimistic-read-");

const isDuplicateParticipantError = (error: unknown) => {
  if (!error || typeof error !== "object") return false;
  const status = (error as { status?: number }).status;
  if (status === 409) return true;
  const message = String((error as Error).message ?? "");
  return message.includes("duplicate key");
};

const fetchParticipant = async (
  dataProvider: DataProvider,
  conversationId: Identifier,
  memberId: Identifier,
) => {
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
  return participants[0];
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

const updateParticipantReadAt = async (
  dataProvider: DataProvider,
  participant: ConversationParticipant,
  readAt: string,
) => {
  await dataProvider.update("conversation_participants", {
    id: participant.id,
    data: { last_read_at: readAt },
    previousData: participant,
  });
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

  let participant = await fetchParticipant(dataProvider, conversationId, memberId);

  if (
    participant?.last_read_at &&
    isReadThrough(participant.last_read_at, readAt) &&
    isPersistedParticipantId(participant.id)
  ) {
    return false;
  }

  try {
    if (participant && isPersistedParticipantId(participant.id)) {
      await updateParticipantReadAt(dataProvider, participant, readAt);
    } else {
      try {
        await dataProvider.create("conversation_participants", {
          data: {
            conversation_id: conversationId,
            member_id: memberId,
            last_read_at: readAt,
          },
        });
      } catch (error) {
        if (!isDuplicateParticipantError(error)) {
          throw error;
        }
        participant = await fetchParticipant(dataProvider, conversationId, memberId);
        if (participant && isPersistedParticipantId(participant.id)) {
          await updateParticipantReadAt(dataProvider, participant, readAt);
        }
      }
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
