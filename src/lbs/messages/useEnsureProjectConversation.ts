import { useEffect, useRef } from "react";
import {
  useCreate,
  useGetIdentity,
  useGetList,
  type Identifier,
} from "ra-core";
import type { Conversation, ConversationParticipant } from "@/lbs/types";

export const useEnsureProjectConversation = (
  dealId: Identifier | null | undefined,
  dealTitle: string,
) => {
  const { identity } = useGetIdentity();
  const memberId = identity?.id;
  const [create] = useCreate();
  const isCreatingRef = useRef(false);

  const {
    data: conversations = [],
    isPending,
    refetch,
  } = useGetList<Conversation>(
    "conversations",
    {
      filter: {
        "deal_id@eq": dealId,
        "type@eq": "project",
      },
      pagination: { page: 1, perPage: 1 },
      sort: { field: "id", order: "ASC" },
    },
    { enabled: dealId != null, staleTime: 30_000 },
  );

  const conversation = conversations[0] ?? null;

  const { data: participants = [], refetch: refetchParticipants } =
    useGetList<ConversationParticipant>(
      "conversation_participants",
      {
        filter: conversation
          ? {
              "conversation_id@eq": conversation.id,
              "member_id@eq": memberId,
            }
          : {},
        pagination: { page: 1, perPage: 1 },
      },
      { enabled: !!conversation && !!memberId, staleTime: 30_000 },
    );

  useEffect(() => {
    if (
      !dealId ||
      !memberId ||
      isPending ||
      conversation ||
      isCreatingRef.current
    ) {
      return;
    }

    isCreatingRef.current = true;
    create(
      "conversations",
      {
        data: {
          type: "project",
          deal_id: dealId,
          title: dealTitle.trim() || "Project team chat",
          created_by_member_id: memberId,
        },
      },
      {
        onSuccess: (record) => {
          create(
            "conversation_participants",
            {
              data: {
                conversation_id: record.id,
                member_id: memberId,
                last_read_at: new Date().toISOString(),
              },
            },
            {
              onSuccess: () => {
                void refetch();
                void refetchParticipants();
                isCreatingRef.current = false;
              },
              onError: () => {
                isCreatingRef.current = false;
              },
            },
          );
        },
        onError: () => {
          isCreatingRef.current = false;
          void refetch();
        },
      },
    );
  }, [
    conversation,
    create,
    dealId,
    dealTitle,
    isPending,
    memberId,
    refetch,
    refetchParticipants,
  ]);

  useEffect(() => {
    if (!conversation || !memberId || participants.length > 0) return;

    create(
      "conversation_participants",
      {
        data: {
          conversation_id: conversation.id,
          member_id: memberId,
          last_read_at: new Date().toISOString(),
        },
      },
      {
        onSuccess: () => {
          void refetchParticipants();
        },
      },
    );
  }, [
    conversation,
    create,
    memberId,
    participants.length,
    refetchParticipants,
  ]);

  return {
    conversation,
    isPending: isPending && !conversation,
    refetch,
  };
};
