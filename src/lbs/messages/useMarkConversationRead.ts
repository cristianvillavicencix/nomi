import { useEffect, useRef } from "react";
import {
  useDataProvider,
  useGetIdentity,
  useGetList,
  type Identifier,
} from "ra-core";
import { useQueryClient } from "@tanstack/react-query";
import type { ConversationParticipant, ConversationType } from "@/lbs/types";
import {
  isReadThrough,
  persistConversationRead,
} from "@/lbs/messages/persistConversationRead";

export const useMarkConversationRead = (
  conversationId: Identifier | null | undefined,
  _conversationType?: ConversationType | null,
  readAt?: string | null,
) => {
  const queryClient = useQueryClient();
  const dataProvider = useDataProvider();
  const { identity } = useGetIdentity();
  const memberId = identity?.id;
  const inFlightRef = useRef<string | null>(null);

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
      enabled: conversationId != null && memberId != null,
      staleTime: 15_000,
    },
  );

  const participant = participants[0];
  const lastReadAt = participant?.last_read_at;

  useEffect(() => {
    if (!conversationId || !memberId) {
      inFlightRef.current = null;
      return;
    }

    const effectiveReadAt = readAt ?? new Date().toISOString();

    if (isReadThrough(lastReadAt, effectiveReadAt)) {
      return;
    }

    const inFlightKey = `${conversationId}:${effectiveReadAt}`;
    if (inFlightRef.current === inFlightKey) {
      return;
    }
    inFlightRef.current = inFlightKey;

    void persistConversationRead({
      dataProvider,
      queryClient,
      conversationId,
      memberId,
      readAt: effectiveReadAt,
    }).finally(() => {
      if (inFlightRef.current === inFlightKey) {
        inFlightRef.current = null;
      }
    });
  }, [conversationId, dataProvider, lastReadAt, memberId, queryClient, readAt]);
};
