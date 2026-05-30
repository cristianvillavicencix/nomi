import { isLbsMode } from "@/lbs/productMode";
import { LBS_LEAD_STATUSES } from "@/lbs/navigation";

export const getClientShowPath = (companyId: string | number) =>
  isLbsMode() ? `/clients/${companyId}/show` : `/companies/${companyId}/show`;

export const getClientEditPath = (companyId: string | number) =>
  isLbsMode() ? `/clients/${companyId}/edit` : `/companies/${companyId}/edit`;

export const getClientCreatePath = () =>
  isLbsMode() ? "/clients/create" : "/companies/create";

export const getLeadsListPath = () => (isLbsMode() ? "/leads" : "/contacts");

export const getLeadShowPath = (contactId: string | number) =>
  isLbsMode() ? `/leads/${contactId}/show` : `/contacts/${contactId}/show`;

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
  companyId: string | number,
  contactId?: string | number | null,
) => {
  const params = new URLSearchParams({ company_id: String(companyId) });
  if (contactId != null) params.set("contact_id", String(contactId));
  return `/proposals/create?${params.toString()}`;
};

export const getClientDealCreatePath = (
  companyId: string | number,
  contactId?: string | number | null,
) => {
  const params = new URLSearchParams({ company_id: String(companyId) });
  if (contactId != null) params.set("contact_id", String(contactId));
  return `/deals/create?${params.toString()}`;
};

export const getPersonListPath = (status?: string | null) =>
  isLbsMode() && isLeadStatus(status)
    ? getLeadsListPath()
    : getClientsListPath();

export const getPersonShowPath = (contact: {
  id: string | number;
  status?: string | null;
}) =>
  isLbsMode() && isLeadStatus(contact.status)
    ? getLeadShowPath(contact.id)
    : getContactShowPath(contact.id);
