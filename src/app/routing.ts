import { LBS_LEAD_STATUSES } from "@/app/navigation";
import { isAccountsHubEnabled } from "@/lib/featureFlags";

export type ClientsHubListTab = "companies" | "people";
export type AccountsHubView = "list" | "board";

/** Canonical Accounts hub entry (`/accounts`). */
export const getAccountsHubPath = (
  view: AccountsHubView = "list",
  tab?: ClientsHubListTab,
) => {
  const params = new URLSearchParams();
  if (view === "board") params.set("view", "board");
  if (tab === "people") params.set("tab", "people");
  const query = params.toString();
  return query ? `/accounts?${query}` : "/accounts";
};

/** Canonical Clients hub entry (`/clients` or Accounts List when hub enabled). */
export const getClientsHubPath = (tab: ClientsHubListTab = "companies") => {
  if (isAccountsHubEnabled()) {
    return getAccountsHubPath("list", tab === "people" ? "people" : undefined);
  }
  if (tab === "people") return "/clients?tab=people";
  return "/clients";
};

/** Bookmark-friendly list aliases — still mount the hub without redirecting. */
export const getCompaniesListPath = () =>
  isAccountsHubEnabled() ? getAccountsHubPath("list") : "/companies";

export const getContactsListPath = () =>
  isAccountsHubEnabled()
    ? getAccountsHubPath("list", "people")
    : "/contacts";

/** Preferred navigation target for the unified Clients / Accounts list. */
export const getClientsListPath = () => getClientsHubPath();

export const getClientShowPath = (companyId: string | number) =>
  `/companies/${companyId}`;

export const getClientEditPath = (companyId: string | number) =>
  `/companies/${companyId}?edit=1`;

export const getClientCreatePath = () =>
  isAccountsHubEnabled()
    ? "/accounts?create=company"
    : "/clients?create=company";

export const getContactCreatePath = () =>
  isAccountsHubEnabled()
    ? "/accounts?create=contact"
    : "/clients?tab=people&create=contact";

export const getFindDuplicatesPath = () => "/companies/find-duplicates";

export const getLeadsListPath = () =>
  isAccountsHubEnabled() ? getAccountsHubPath("board") : "/leads";

export const getLeadKanbanShowPath = (
  contactId: string | number,
  stage: string,
) => `/leads/${contactId}/show?stage=${encodeURIComponent(stage)}`;

export const getLeadCreatePath = (params?: Record<string, string>) => {
  const search = new URLSearchParams({ create: "lead" });
  if (params) {
    for (const [key, value] of Object.entries(params)) {
      if (value) search.set(key, value);
    }
  }
  if (isAccountsHubEnabled()) {
    search.set("view", "board");
    return `/accounts?${search.toString()}`;
  }
  return `/leads?${search.toString()}`;
};

export const getDealsListPath = () => "/deals";

export const getLeadShowPath = (contactId: string | number) =>
  `/leads/${contactId}/show`;

export const getContactShowPath = (contactId: string | number) =>
  `/contacts/${contactId}/show`;

export const isLeadStatus = (status?: string | null) =>
  !!status && (LBS_LEAD_STATUSES as readonly string[]).includes(status);

export const getWebMonitorPath = () => "/web-monitor";

export const getHostingerPath = (tab?: string) =>
  tab && tab !== "domains"
    ? `/hostinger?tab=${encodeURIComponent(tab)}`
    : "/hostinger";

export const getClientProposalCreatePath = (
  companyId?: string | number | null,
  contactId?: string | number | null,
  dealId?: string | number | null,
) => {
  const params = new URLSearchParams();
  if (companyId != null) params.set("company_id", String(companyId));
  if (contactId != null) params.set("contact_id", String(contactId));
  if (dealId != null) params.set("deal_id", String(dealId));
  const query = params.toString();
  return query ? `/proposals/create?${query}` : "/proposals/create";
};

export const getLeadProposalCreatePath = (
  contactId: string | number,
  companyId?: string | number | null,
  dealId?: string | number | null,
) => getClientProposalCreatePath(companyId, contactId, dealId);

import { getNewDealManualCreatePath } from "@/modules/deals/projectCreatePaths";

export const getClientDealCreatePath = (
  companyId: string | number,
  contactId?: string | number | null,
) => getNewDealManualCreatePath(companyId, contactId);

export const getPersonListPath = (status?: string | null) =>
  isLeadStatus(status) ? getLeadsListPath() : getContactsListPath();

export const getPersonShowPath = (contact: {
  id: string | number;
  status?: string | null;
}) =>
  isLeadStatus(contact.status)
    ? getLeadShowPath(contact.id)
    : getContactShowPath(contact.id);
