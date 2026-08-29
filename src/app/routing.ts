import { LBS_LEAD_STATUSES } from "@/app/navigation";

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

/** Accounts List (legacy name kept for callers). */
export const getClientsHubPath = (tab: ClientsHubListTab = "companies") =>
  getAccountsHubPath("list", tab === "people" ? "people" : undefined);

/** Bookmark-friendly list aliases — redirect to Accounts List. */
export const getCompaniesListPath = () => getAccountsHubPath("list");

export const getContactsListPath = () => getAccountsHubPath("list", "people");

/** Preferred navigation target for the unified Accounts list. */
export const getClientsListPath = () => getClientsHubPath();

export const getClientShowPath = (companyId: string | number) =>
  `/companies/${companyId}`;

export const getClientEditPath = (companyId: string | number) =>
  `/companies/${companyId}?edit=1`;

export const getClientCreatePath = () => "/accounts?create=company";

export const getContactCreatePath = () => "/accounts?create=contact";

export const getFindDuplicatesPath = () => "/companies/find-duplicates";

export const getLeadsListPath = () => getAccountsHubPath("board");

/**
 * Board card click target — stays on Accounts Board with Sheet preview.
 */
export const getLeadKanbanShowPath = (
  contactId: string | number,
  stage: string,
) => {
  const params = new URLSearchParams({
    view: "board",
    lead: String(contactId),
    contact: String(contactId),
    stage,
  });
  return `/accounts?${params.toString()}`;
};

export const getLeadCreatePath = (params?: Record<string, string>) => {
  const search = new URLSearchParams({ create: "lead", view: "board" });
  if (params) {
    for (const [key, value] of Object.entries(params)) {
      if (value) search.set(key, value);
    }
  }
  return `/accounts?${search.toString()}`;
};

export const getDealsListPath = () => "/deals";

/** @deprecated Alias of {@link getContactShowPath} — Person Full is unified. */
export const getLeadShowPath = (contactId: string | number) =>
  getContactShowPath(contactId);

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

export const getClientInvoiceCreatePath = (
  companyId?: string | number | null,
  contactId?: string | number | null,
) => {
  const params = new URLSearchParams();
  if (companyId != null) params.set("company_id", String(companyId));
  if (contactId != null) params.set("contact_id", String(contactId));
  const query = params.toString();
  return query ? `/billing/invoices/new?${query}` : "/billing/invoices/new";
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

/** Canonical Person Full — always `/contacts/:id/show` (lead vs client is status, not URL). */
export const getPersonShowPath = (contact: {
  id: string | number;
  status?: string | null;
}) => getContactShowPath(contact.id);
