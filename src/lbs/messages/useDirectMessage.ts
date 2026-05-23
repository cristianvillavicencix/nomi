import { useCallback } from "react";
import {
  useCreate,
  useDataProvider,
  useGetIdentity,
  type Identifier,
} from "ra-core";
import type { Conversation, OrganizationMember } from "@/lbs/types";
import { buildDmKey } from "@/lbs/messages/conversationUtils";

export const useOpenDirectMessage = () => {
  const dataProvider = useDataProvider();
  const { identity } = useGetIdentity();
  const [create] = useCreate();

  const openDirectMessage = useCallback(
    async (otherMember: OrganizationMember): Promise<Conversation> => {
      const currentMemberId = identity?.id;
      if (!currentMemberId) {
        throw new Error("Missing current member");
      }
      if (String(otherMember.id) === String(currentMemberId)) {
        throw new Error("Cannot message yourself");
      }

      const dmKey = buildDmKey(currentMemberId, otherMember.id);
      const { data: existing = [] } = await dataProvider.getList<Conversation>(
        "conversations",
        {
          filter: {
            "type@eq": "team_dm",
            "dm_key@eq": dmKey,
          },
          pagination: { page: 1, perPage: 1 },
          sort: { field: "id", order: "ASC" },
        },
      );

      if (existing[0]) {
        return existing[0];
      }

      const title =
        `${otherMember.first_name ?? ""} ${otherMember.last_name ?? ""}`.trim() ||
        "Direct message";

      const conversation = await new Promise<Conversation>(
        (resolve, reject) => {
          create(
            "conversations",
            {
              data: {
                type: "team_dm",
                title,
                dm_key: dmKey,
                created_by_member_id: currentMemberId,
              },
            },
            {
              onSuccess: (record) => resolve(record as Conversation),
              onError: reject,
            },
          );
        },
      );

      await Promise.all(
        [currentMemberId, otherMember.id].map(
          (memberId) =>
            new Promise<void>((resolve, reject) => {
              create(
                "conversation_participants",
                {
                  data: {
                    conversation_id: conversation.id,
                    member_id: memberId,
                  },
                },
                {
                  onSuccess: () => resolve(),
                  onError: reject,
                },
              );
            }),
        ),
      );

      return conversation;
    },
    [create, dataProvider, identity?.id],
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
