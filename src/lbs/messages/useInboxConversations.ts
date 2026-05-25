import { useMemo } from "react";
import {
  useDataProvider,
  useGetIdentity,
  useGetList,
  useGetMany,
  type Identifier,
} from "ra-core";
import type {
  Contact,
  Conversation,
  ConversationParticipant,
  LbsDeal,
  OrganizationMember,
} from "@/lbs/types";
import { sortConversationsByActivity } from "@/lbs/messages/conversationUtils";
import {
  filterConversationsForAssignedProjects,
  shouldScopeMessagingToAssignedProjects,
} from "@/lbs/messages/scopedMessaging";
import type { CrmDataProvider } from "@/components/atomic-crm/providers/types";
import { useQuery } from "@tanstack/react-query";

export const useInboxConversations = (
  options: { enabled?: boolean; pageSize?: number } = {},
) => {
  const enabled = options.enabled ?? true;
  const pageSize = options.pageSize ?? 30;
  const { identity } = useGetIdentity();
  const dataProvider = useDataProvider<CrmDataProvider>();
  const scopeToProjects = shouldScopeMessagingToAssignedProjects(identity);

  const { data: allowedDealIds, isPending: isAssignedDealsPending } = useQuery({
    queryKey: ["messaging-assigned-deal-ids", identity?.id, scopeToProjects],
    enabled: enabled && scopeToProjects && identity?.id != null,
    staleTime: 60_000,
    queryFn: async () => {
      const dealIds = await dataProvider.getMyProjectDealIds({
        organizationMemberId: identity!.id,
      });
      return new Set(dealIds.map(String));
    },
  });

  const { data: participations = [], isPending: isParticipantsPending } =
    useGetList<ConversationParticipant>(
      "conversation_participants",
      {
        filter: identity?.id ? { "member_id@eq": identity.id } : {},
        pagination: { page: 1, perPage: 500 },
        sort: { field: "id", order: "DESC" },
      },
      { enabled: enabled && !!identity?.id, staleTime: 15_000 },
    );

  const { data: projectConversations = [], isPending: isProjectsPending } =
    useGetList<Conversation>(
      "conversations",
      {
        filter: { "type@eq": "project" },
        pagination: { page: 1, perPage: pageSize },
        sort: { field: "updated_at", order: "DESC" },
      },
      { enabled, staleTime: 15_000 },
    );

  const { data: clientConversations = [], isPending: isClientsPending } =
    useGetList<Conversation>(
      "conversations",
      {
        filter: { "type@eq": "client" },
        pagination: { page: 1, perPage: pageSize },
        sort: { field: "updated_at", order: "DESC" },
      },
      { enabled, staleTime: 15_000 },
    );

  const conversationIds = useMemo(() => {
    const ids = new Set<string>();
    participations.forEach((entry) => ids.add(String(entry.conversation_id)));
    projectConversations.forEach((entry) => ids.add(String(entry.id)));
    clientConversations.forEach((entry) => ids.add(String(entry.id)));
    return [...ids];
  }, [participations, projectConversations, clientConversations]);

  const { data: conversations = [], isPending: isConversationsPending } =
    useGetMany<Conversation>(
      "conversations",
      { ids: conversationIds },
      { enabled: enabled && conversationIds.length > 0, staleTime: 15_000 },
    );

  const participantConversationIds = useMemo(
    () => new Set(participations.map((entry) => String(entry.conversation_id))),
    [participations],
  );

  const visibleConversations = useMemo(() => {
    const base = sortConversationsByActivity(
      conversations.filter((conversation) => {
        if (!conversation.last_message_at) {
          return false;
        }
        return (
          conversation.type === "project" ||
          conversation.type === "client" ||
          participantConversationIds.has(String(conversation.id))
        );
      }),
    );
    if (!scopeToProjects) {
      return base;
    }
    if (isAssignedDealsPending) {
      return base.filter((conversation) => conversation.type === "team_dm");
    }
    return filterConversationsForAssignedProjects(
      base,
      allowedDealIds ?? new Set(),
      identity?.id,
    );
  }, [
    allowedDealIds,
    conversations,
    identity?.id,
    isAssignedDealsPending,
    participantConversationIds,
    scopeToProjects,
  ]);

  const dealIds = useMemo(
    () => [
      ...new Set(
        visibleConversations
          .map((conversation) => conversation.deal_id)
          .filter((id): id is Identifier => id != null),
      ),
    ],
    [visibleConversations],
  );

  const { data: deals = [] } = useGetMany<LbsDeal>(
    "deals",
    { ids: dealIds },
    { enabled: enabled && dealIds.length > 0, staleTime: 60_000 },
  );

  const dmConversationIds = useMemo(
    () =>
      visibleConversations
        .filter((conversation) => conversation.type === "team_dm")
        .map((conversation) => conversation.id),
    [visibleConversations],
  );

  const { data: dmParticipants = [] } = useGetList<ConversationParticipant>(
    "conversation_participants",
    {
      filter:
        dmConversationIds.length > 0
          ? { "conversation_id@in": `(${dmConversationIds.join(",")})` }
          : {},
      pagination: { page: 1, perPage: 500 },
    },
    { enabled: enabled && dmConversationIds.length > 0, staleTime: 30_000 },
  );

  const memberIds = useMemo(
    () => [
      ...new Set(
        dmParticipants
          .map((entry) => entry.member_id)
          .filter((id): id is Identifier => id != null),
      ),
    ],
    [dmParticipants],
  );

  const { data: members = [] } = useGetMany<OrganizationMember>(
    "organization_members",
    { ids: memberIds },
    { enabled: enabled && memberIds.length > 0, staleTime: 60_000 },
  );

  const contactIds = useMemo(
    () => [
      ...new Set(
        visibleConversations
          .map((conversation) => conversation.contact_id)
          .filter((id): id is Identifier => id != null),
      ),
    ],
    [visibleConversations],
  );

  const { data: contacts = [] } = useGetMany<Contact>(
    "contacts",
    { ids: contactIds },
    { enabled: enabled && contactIds.length > 0, staleTime: 60_000 },
  );

  return {
    conversations: visibleConversations,
    participations,
    deals,
    dmParticipants,
    members,
    contacts,
    isPending:
      isParticipantsPending ||
      isProjectsPending ||
      isClientsPending ||
      isConversationsPending,
  };
};
