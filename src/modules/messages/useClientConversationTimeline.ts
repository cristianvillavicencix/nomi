import { useCallback, useMemo } from "react";
import type { Identifier } from "ra-core";
import { useConversationMessages } from "@/modules/messages/useConversationMessages";
import { useConversationVoiceCalls } from "@/modules/voice/useConversationVoiceCalls";
import { mergeClientConversationTimeline } from "@/modules/voice/voiceCallTimeline";

export const useClientConversationTimeline = (
  conversationId: Identifier | null | undefined,
  options?: { includeCalls?: boolean },
) => {
  const includeCalls = options?.includeCalls ?? true;
  const messageState = useConversationMessages(conversationId);
  const {
    calls,
    isPending: callsPending,
    canView,
    refetch: refetchCalls,
  } = useConversationVoiceCalls(conversationId);

  const timeline = useMemo(
    () =>
      mergeClientConversationTimeline(
        messageState.messages,
        includeCalls && canView ? calls : [],
      ),
    [includeCalls, messageState.messages, calls, canView],
  );

  const refetch = useCallback(() => {
    void messageState.refetch();
    void refetchCalls();
  }, [messageState, refetchCalls]);

  return {
    ...messageState,
    timeline,
    refetch,
    isPending:
      messageState.isPending ||
      (conversationId != null && canView && callsPending),
  };
};
