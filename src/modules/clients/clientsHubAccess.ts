import {
  canAccess,
  type AccessIdentity,
} from "@/components/atomic-crm/providers/commons/canAccess";
import {
  CLIENTS_HUB_TABS,
  type ClientsHubTab,
} from "@/modules/clients/clientsHubTabs";

const TAB_RESOURCE: Record<
  ClientsHubTab,
  { resource: string; action: string }
> = {
  companies: { resource: "companies", action: "list" },
  people: { resource: "contacts", action: "list" },
};

export const canAccessClientsHubTab = (
  identity: unknown,
  tab: ClientsHubTab,
): boolean => {
  const { resource, action } = TAB_RESOURCE[tab];
  return canAccess(identity as AccessIdentity, { resource, action });
};

/** Tabs the current user may see in the Clients hub (stable order: Companies, then People). */
export const getAccessibleClientsHubTabs = (
  identity: unknown,
): ClientsHubTab[] =>
  CLIENTS_HUB_TABS.filter((tab) => canAccessClientsHubTab(identity, tab));

/**
 * Picks the tab to show: requested when allowed, otherwise the first accessible tab.
 * Returns null when the user cannot access any hub tab.
 */
export const resolveDefaultClientsHubTab = (
  identity: unknown,
  requested?: ClientsHubTab | null,
): ClientsHubTab | null => {
  const accessible = getAccessibleClientsHubTabs(identity);
  if (accessible.length === 0) return null;
  if (requested && accessible.includes(requested)) return requested;
  return accessible[0];
};
