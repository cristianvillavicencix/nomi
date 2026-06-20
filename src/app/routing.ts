import { LBS_LEAD_STATUSES } from "@/app/navigation";

export const getCompaniesListPath = () => "/companies";

export const getContactsListPath = () => "/contacts";

/** @deprecated Use getCompaniesListPath */
export const getClientsListPath = getCompaniesListPath;

export const getClientShowPath = (companyId: string | number) =>
  `/companies/${companyId}`;

export const getClientEditPath = (companyId: string | number) =>
  `/companies/${companyId}?edit=1`;

export const getClientCreatePath = () => "/companies?create=company";

export const getContactCreatePath = () => "/contacts?create=contact";

export const getFindDuplicatesPath = () => "/companies/find-duplicates";

export const getLeadsListPath = () => "/leads";

export const getDealsListPath = () => "/deals";

export const getLeadShowPath = (contactId: string | number) =>
  `/leads/${contactId}/show`;

export const getContactShowPath = (contactId: string | number) =>
  `/contacts/${contactId}/show`;

export const isLeadStatus = (status?: string | null) =>
  !!status && (LBS_LEAD_STATUSES as readonly string[]).includes(status);

export const getWebMonitorPath = () => "/web-monitor";

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

export const getClientDealCreatePath = (
  companyId: string | number,
  contactId?: string | number | null,
) => {
  const params = new URLSearchParams({ company_id: String(companyId) });
  if (contactId != null) params.set("contact_id", String(contactId));
  return `/deals/create?${params.toString()}`;
};

export const getPersonListPath = (status?: string | null) =>
  isLeadStatus(status) ? getLeadsListPath() : getContactsListPath();

export const getPersonShowPath = (contact: {
  id: string | number;
  status?: string | null;
}) =>
  isLeadStatus(contact.status)
    ? getLeadShowPath(contact.id)
    : getContactShowPath(contact.id);
