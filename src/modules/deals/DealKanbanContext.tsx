import { createContext, useContext } from "react";
import type { OrganizationMember } from "@/components/atomic-crm/types";

export type DealKanbanContextValue = {
  membersById: Record<string, OrganizationMember>;
};

const DealKanbanContext = createContext<DealKanbanContextValue>({
  membersById: {},
});

export const DealKanbanProvider = DealKanbanContext.Provider;

export const useDealKanbanContext = () => useContext(DealKanbanContext);
