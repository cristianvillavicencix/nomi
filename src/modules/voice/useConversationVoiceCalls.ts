import { useGetList, type Identifier } from "ra-core";
import type { VoiceCall } from "@/modules/types";
import { useMemberCapability } from "@/components/atomic-crm/providers/commons/useMemberCapability";

export const useConversationVoiceCalls = (
  conversationId: Identifier | null | undefined,
) => {
  const canView = useMemberCapability("voice.calls.view");

  const { data = [], isPending, refetch } = useGetList<VoiceCall>(
    "voice_calls",
    {
      filter: conversationId ? { "conversation_id@eq": conversationId } : {},
      pagination: { page: 1, perPage: 25 },
      sort: { field: "created_at", order: "DESC" },
    },
    { enabled: conversationId != null && canView, staleTime: 10_000 },
  );

  return {
    calls: data,
    isPending: conversationId != null && canView && isPending,
    refetch,
    canView,
  };
};
