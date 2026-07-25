import { useMemo } from "react";
import { useGetList } from "ra-core";

import type {
  Contact,
  OrganizationMember,
} from "@/components/atomic-crm/types";
import type { Conversation } from "@/modules/types";
import { isLeadTerminalStage } from "@/modules/leads/leadFollowUpUtils";

export const useLeadKanbanEnrichment = (leads: Contact[] | undefined) => {
  const { data: members = [] } = useGetList<OrganizationMember>(
    "organization_members",
    {
      pagination: { page: 1, perPage: 100 },
      sort: { field: "first_name", order: "ASC" },
    },
  );

  const { data: clientConversations = [] } = useGetList<Conversation>(
    "conversations",
    {
      pagination: { page: 1, perPage: 500 },
      sort: { field: "last_message_at", order: "DESC" },
      filter: { "type@eq": "client" },
    },
  );

  return useMemo(() => {
    const membersById = Object.fromEntries(
      members.map((member) => [String(member.id), member]),
    );

    const activeLeads = (leads ?? []).filter(
      (lead) => !isLeadTerminalStage(lead.lead_stage),
    );
    const contactIds = new Set(activeLeads.map((lead) => String(lead.id)));
    const conversationsByContactId: Record<string, Conversation> = {};

    for (const conversation of clientConversations) {
      if (conversation.contact_id == null) continue;
      const key = String(conversation.contact_id);
      if (!contactIds.has(key) || conversationsByContactId[key]) continue;
      conversationsByContactId[key] = conversation;
    }

    return { membersById, conversationsByContactId };
  }, [clientConversations, leads, members]);
};
