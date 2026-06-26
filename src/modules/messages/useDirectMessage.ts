import { useCallback } from "react";
import { useDataProvider, useGetIdentity, type Identifier } from "ra-core";
import type { Conversation, OrganizationMember } from "@/modules/types";
import type { CrmDataProvider } from "@/components/atomic-crm/providers/types";

export const useOpenDirectMessage = () => {
  const dataProvider = useDataProvider<CrmDataProvider>();
  const { identity } = useGetIdentity();

  const openDirectMessage = useCallback(
    async (otherMember: OrganizationMember): Promise<Conversation> => {
      const currentMemberId = identity?.id;
      if (!currentMemberId) {
        throw new Error("Missing current member");
      }
      if (String(otherMember.id) === String(currentMemberId)) {
        throw new Error("Cannot message yourself");
      }

      const conversationId = await dataProvider.ensureTeamDmConversation({
        otherMemberId: otherMember.id,
      });

      const { data: conversation } = await dataProvider.getOne<Conversation>(
        "conversations",
        { id: conversationId },
      );

      if (!conversation) {
        throw new Error("Conversation not found after creation");
      }

      return conversation;
    },
    [dataProvider, identity?.id],
  );

  return { openDirectMessage };
};

export const getOtherDmMemberId = (
  conversation: Conversation,
  participantMemberIds: Identifier[],
  currentMemberId: Identifier | undefined,
) =>
  participantMemberIds.find(
    (memberId) => String(memberId) !== String(currentMemberId),
  ) ?? (conversation.type === "team_dm" ? null : null);
