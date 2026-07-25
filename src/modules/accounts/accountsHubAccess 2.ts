import {
  canAccess,
  type AccessIdentity,
} from "@/components/atomic-crm/providers/commons/canAccess";
import { getAccessibleClientsHubTabs } from "@/modules/clients/clientsHubAccess";
import type { AccountsHubView } from "@/modules/accounts/accountsHubSearchParams";

/** User can open Accounts List (companies and/or people directory). */
export const canAccessAccountsList = (identity: unknown): boolean =>
  getAccessibleClientsHubTabs(identity).length > 0;

/** User can open Accounts Board (leads pipeline / contacts list). */
export const canAccessAccountsBoard = (identity: unknown): boolean =>
  canAccess(identity as AccessIdentity, {
    resource: "contacts",
    action: "list",
  });

/** Enter `/accounts` when List or Board is allowed. */
export const canAccessAccountsHub = (identity: unknown): boolean =>
  canAccessAccountsList(identity) || canAccessAccountsBoard(identity);

export const getAccessibleAccountsViews = (
  identity: unknown,
): AccountsHubView[] => {
  const views: AccountsHubView[] = [];
  if (canAccessAccountsList(identity)) views.push("list");
  if (canAccessAccountsBoard(identity)) views.push("board");
  return views;
};

/**
 * Picks the view to show: requested when allowed, otherwise first accessible.
 * Returns null when the user cannot access any Accounts mode.
 */
export const resolveDefaultAccountsView = (
  identity: unknown,
  requested?: AccountsHubView | null,
): AccountsHubView | null => {
  const accessible = getAccessibleAccountsViews(identity);
  if (accessible.length === 0) return null;
  if (requested && accessible.includes(requested)) return requested;
  return accessible[0];
};
