import { useEffect, useRef } from "react";
import {
  useCreate,
  useGetIdentity,
  useGetList,
  useUpdate,
  type Identifier,
} from "ra-core";
import type { ConversationParticipant, ConversationType } from "@/lbs/types";

const usesParticipantReadTracking = (type?: ConversationType | null) =>
  type === "team_dm";

export const useMarkConversationRead = (
  conversationId: Identifier | null | undefined,
  conversationType?: ConversationType | null,
) => {
  const tracksRead = usesParticipantReadTracking(conversationType);
  const { identity } = useGetIdentity();
  const memberId = identity?.id;
  const [update] = useUpdate();
  const [create] = useCreate();
  const createAttemptKeyRef = useRef<string | null>(null);

  const { data: participants = [] } = useGetList<ConversationParticipant>(
    "conversation_participants",
    {
      filter:
        conversationId && memberId
          ? {
              "conversation_id@eq": conversationId,
              "member_id@eq": memberId,
            }
          : {},
      pagination: { page: 1, perPage: 1 },
    },
    {
      enabled: tracksRead && conversationId != null && memberId != null,
      staleTime: 30_000,
    },
  );

  const participant = participants[0];
  const participantId = participant?.id;
  const lastReadAt = participant?.last_read_at;

  useEffect(() => {
    if (!tracksRead || !conversationId || !memberId) {
      createAttemptKeyRef.current = null;
      return;
    }

    const now = new Date().toISOString();
    const conversationKey = String(conversationId);

    if (!participantId) {
      if (createAttemptKeyRef.current === conversationKey) {
        return;
      }
      createAttemptKeyRef.current = conversationKey;
      create(
        "conversation_participants",
        {
          data: {
            conversation_id: conversationId,
            member_id: memberId,
            last_read_at: now,
          },
        },
        {
          onError: () => {
            createAttemptKeyRef.current = null;
          },
        },
      );
      return;
    }

    createAttemptKeyRef.current = null;

    if (lastReadAt && Date.now() - Date.parse(lastReadAt) < 30_000) {
      return;
    }

    update(
      "conversation_participants",
      {
        id: participantId,
        data: { last_read_at: now },
        previousData: participant,
      },
      { mutationMode: "optimistic" },
    );
  }, [
    tracksRead,
    conversationId,
    create,
    memberId,
    participantId,
    lastReadAt,
    participant,
    update,
  ]);
};
