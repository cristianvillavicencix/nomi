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
  const { data: participants } = await dataProvider.getList<ConversationParticipant>(
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

  if (participant?.last_read_at && isReadThrough(participant.last_read_at, readAt)) {
    return false;
  }

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

  await queryClient.invalidateQueries({ queryKey: ["conversation_participants"] });
  return true;
};
