import { LBS_LEAD_STATUSES } from "@/lbs/navigation";

export const getClientShowPath = (companyId: string | number) =>
  `/clients/${companyId}/show`;

export const getClientEditPath = (companyId: string | number) =>
  `/clients/${companyId}/edit`;

export const getClientCreatePath = () => "/clients/create";

export const getLeadsListPath = () => "/leads";

export const getLeadShowPath = (contactId: string | number) =>
  `/leads/${contactId}/show`;

export const getContactShowPath = (contactId: string | number) =>
  `/contacts/${contactId}/show`;

export const isLeadStatus = (status?: string | null) =>
  !!status && (LBS_LEAD_STATUSES as readonly string[]).includes(status);

export const getClientsListPath = () => "/clients";

export const getWebMonitorPath = () => "/web-monitor";

export const getWebMonitorShowPath = (siteId: string | number) =>
  `/web-monitor/${siteId}/show`;

export const getContactsListPath = () => "/clients?tab=contacts";

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
  isLeadStatus(status) ? getLeadsListPath() : getClientsListPath();

export const getPersonShowPath = (contact: {
  id: string | number;
  status?: string | null;
}) =>
  isLeadStatus(contact.status)
    ? getLeadShowPath(contact.id)
    : getContactShowPath(contact.id);
