import { useGetList, type Identifier } from "ra-core";
import { TASK_STATUS_FILTERS } from "@/components/atomic-crm/tasks/taskConstants";
import type { Contact, Deal } from "@/components/atomic-crm/types";
import type { Contract, Proposal, Ticket } from "@/lbs/types";

const countQuery = (resource: string, filter: Record<string, unknown>) => ({
  filter,
  pagination: { page: 1, perPage: 1 },
  sort: { field: "id", order: "DESC" as const },
});

export const useContactTabCounts = (contact: Contact | null | undefined) => {
  const contactId = contact?.id ?? "";
  const companyId = contact?.company_id ?? "";
  const enabled = contactId !== "" && contactId != null;
  const companyEnabled = companyId !== "" && companyId != null;
  const staleTime = 30_000;

  const { total: projects = 0 } = useGetList<Deal>(
    "deals",
    countQuery("deals", { "contact_ids@cs": `{${contactId}}` }),
    { staleTime, enabled },
  );

  const { total: proposals = 0 } = useGetList<Proposal>(
    "proposals",
    countQuery("proposals", { "company_id@eq": companyId }),
    { staleTime, enabled: enabled && companyEnabled },
  );

  const { total: contracts = 0 } = useGetList<Contract>(
    "contracts",
    countQuery("contracts", { "company_id@eq": companyId }),
    { staleTime, enabled: enabled && companyEnabled },
  );

  const { data: contactDeals = [] } = useGetList<Deal>(
    "deals",
    {
      filter: { "contact_ids@cs": `{${contactId}}` },
      pagination: { page: 1, perPage: 200 },
      sort: { field: "id", order: "ASC" },
    },
    { staleTime, enabled },
  );

  const dealIds = contactDeals.map((deal) => deal.id);
  const paymentsFilter =
    dealIds.length > 0
      ? { "deal_id@in": `(${dealIds.join(",")})` }
      : { "deal_id@eq": -1 };

  const { total: payments = 0 } = useGetList(
    "deal_client_payments",
    countQuery("deal_client_payments", paymentsFilter),
    { staleTime, enabled: enabled && dealIds.length > 0 },
  );

  const contactFilter = { "contact_id@eq": contactId };

  const { total: tasks = 0 } = useGetList(
    "tasks",
    countQuery("tasks", { ...contactFilter, ...TASK_STATUS_FILTERS.open }),
    { staleTime, enabled },
  );

  const { total: notes = 0 } = useGetList(
    "contact_notes",
    countQuery("contact_notes", contactFilter),
    { staleTime, enabled },
  );

  const { total: referrals = 0 } = useGetList<Contact>(
    "contacts",
    countQuery("contacts", { "referred_by_contact_id@eq": contactId }),
    { staleTime, enabled },
  );

  const { total: tickets = 0 } = useGetList<Ticket>(
    "tickets",
    countQuery("tickets", { "contact_id@eq": contactId }),
    { staleTime, enabled },
  );

  return {
    projects,
    proposals,
    contracts,
    payments,
    tasks,
    notes,
    referrals,
    tickets,
    contactIds: enabled ? ([contactId] as Identifier[]) : ([] as Identifier[]),
    companyId,
    hasCompany: companyEnabled,
  };
};
