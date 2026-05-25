import type { Identifier } from "ra-core";
import { isScopedWorkspaceUser } from "@/lib/permissions/permissionCatalog";
import { collectMyProjectDealIds } from "@/components/atomic-crm/tasks/scopedTasksFilter";
import type { Conversation, LbsDeal } from "@/lbs/types";

type ScopedIdentity = {
  id?: Identifier;
  administrator?: boolean;
  module_permissions?: Record<string, boolean | string | undefined> | null;
};

export function shouldScopeMessagingToAssignedProjects(
  identity: ScopedIdentity | null | undefined,
): boolean {
  return isScopedWorkspaceUser(identity);
}

export function filterConversationsForAssignedProjects(
  conversations: Conversation[],
  allowedDealIds: Set<string>,
  currentMemberId?: Identifier | null,
): Conversation[] {
  const me = currentMemberId != null ? String(currentMemberId) : null;
  return conversations.filter((conversation) => {
    if (conversation.type === "team_dm") return true;
    if (
      me != null &&
      conversation.assignee_member_id != null &&
      String(conversation.assignee_member_id) === me
    ) {
      return true;
    }
    if (conversation.deal_id == null) return false;
    return allowedDealIds.has(String(conversation.deal_id));
  });
}

export function collectCoworkerMemberIdsFromDeals(
  deals: Array<Pick<LbsDeal, "id" | "organization_member_id">>,
  allowedDealIds: Set<string>,
  currentMemberId: Identifier,
): Set<string> {
  const memberIds = new Set<string>();
  const currentKey = String(currentMemberId);

  deals.forEach((deal) => {
    if (!allowedDealIds.has(String(deal.id))) return;
    if (deal.organization_member_id != null) {
      const memberId = String(deal.organization_member_id);
      if (memberId !== currentKey) memberIds.add(memberId);
    }
  });

  return memberIds;
}

export function buildAssignedProjectDealIdSet(
  deals: Array<{
    id: Identifier;
    organization_member_id?: Identifier | null;
    salesperson_ids?: Identifier[];
  }>,
  organizationMemberId: Identifier,
  personId?: Identifier | null,
): Set<string> {
  return new Set(
    collectMyProjectDealIds(deals, organizationMemberId, personId).map(String),
  );
}
