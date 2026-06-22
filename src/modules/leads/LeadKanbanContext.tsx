import { createContext, useContext } from "react";

import type { OrganizationMember } from "@/components/atomic-crm/types";
import type { Conversation } from "@/modules/types";

export type LeadKanbanContextValue = {
  membersById: Record<string, OrganizationMember>;
  conversationsByContactId: Record<string, Conversation>;
};

const LeadKanbanContext = createContext<LeadKanbanContextValue>({
  membersById: {},
  conversationsByContactId: {},
});

export const LeadKanbanProvider = LeadKanbanContext.Provider;

export const useLeadKanbanContext = () => useContext(LeadKanbanContext);
