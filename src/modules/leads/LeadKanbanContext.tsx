import { createContext, useContext } from "react";

import type { Contact, OrganizationMember } from "@/components/atomic-crm/types";
import type { Conversation } from "@/modules/types";
import type { LeadStageId } from "@/modules/leads/leadStages";

export type LeadKanbanContextValue = {
  membersById: Record<string, OrganizationMember>;
  conversationsByContactId: Record<string, Conversation>;
  requestStageChange: (lead: Contact, toStage: LeadStageId) => void;
};

const noopRequestStageChange = () => undefined;

const LeadKanbanContext = createContext<LeadKanbanContextValue>({
  membersById: {},
  conversationsByContactId: {},
  requestStageChange: noopRequestStageChange,
});

export const LeadKanbanProvider = LeadKanbanContext.Provider;

export const useLeadKanbanContext = () => useContext(LeadKanbanContext);
