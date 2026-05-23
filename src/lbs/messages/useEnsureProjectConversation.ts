import { useEffect, useRef } from "react";
import {
  useDataProvider,
  useGetIdentity,
  useGetList,
  type Identifier,
} from "ra-core";
import type { CrmDataProvider } from "@/components/atomic-crm/providers/types";
import type { Conversation } from "@/lbs/types";

export const useEnsureProjectConversation = (
  dealId: Identifier | null | undefined,
  dealTitle: string,
) => {
  const dataProvider = useDataProvider<CrmDataProvider>();
  const { identity } = useGetIdentity();
  const memberId = identity?.id;
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
    void dataProvider
      .ensureProjectConversation({
        dealId,
        title: dealTitle.trim() || "Project team chat",
      })
      .then(() => refetch())
      .catch((error) => {
        console.error("useEnsureProjectConversation", error);
      })
      .finally(() => {
        isCreatingRef.current = false;
      });
  }, [conversation, dataProvider, dealId, dealTitle, isPending, memberId, refetch]);

  return {
    conversation,
    isPending: isPending && !conversation,
    refetch,
  };
};
