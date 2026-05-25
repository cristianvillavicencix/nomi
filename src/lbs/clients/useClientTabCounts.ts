import { useGetList, type Identifier } from "ra-core";
import { TASK_STATUS_FILTERS } from "@/components/atomic-crm/tasks/taskConstants";
import type { Company, Contact, Deal } from "@/components/atomic-crm/types";
import type { FormSubmissionV2 } from "@/lbs/forms-v2/types";

const countQuery = (resource: string, filter: Record<string, unknown>) => ({
  filter,
  pagination: { page: 1, perPage: 1 },
  sort: { field: "id", order: "DESC" as const },
});

export const useClientTabCounts = (companyId: Company["id"] | "") => {
  const enabled = companyId !== "" && companyId != null;
  const staleTime = 30_000;

  const { total: contacts = 0 } = useGetList<Contact>(
    "contacts",
    countQuery("contacts", { "company_id@eq": companyId }),
    { staleTime, enabled },
  );
  const { total: projects = 0 } = useGetList<Deal>(
    "deals",
    countQuery("deals", { "company_id@eq": companyId }),
    { staleTime, enabled },
  );
  const { total: proposals = 0 } = useGetList<Proposal>(
    "proposals",
    countQuery("proposals", { "company_id@eq": companyId }),
    { staleTime, enabled },
  );
  const { total: contracts = 0 } = useGetList<Contract>(
    "contracts",
    countQuery("contracts", { "company_id@eq": companyId }),
    { staleTime, enabled },
  );
  const { total: tickets = 0 } = useGetList<Ticket>(
    "tickets",
    countQuery("tickets", { "company_id@eq": companyId }),
    { staleTime, enabled },
  );
  const { total: webForms = 0 } = useGetList<FormSubmissionV2>(
    "form_submissions_v2",
    countQuery("form_submissions_v2", { "company_id@eq": companyId }),
    { staleTime, enabled },
  );

  const { data: companyDeals = [] } = useGetList<Deal>(
    "deals",
    {
      filter: { "company_id@eq": companyId },
      pagination: { page: 1, perPage: 200 },
      sort: { field: "id", order: "ASC" },
    },
    { staleTime, enabled },
  );

  const dealIds = companyDeals.map((deal) => deal.id);
  const paymentsFilter =
    dealIds.length > 0
      ? { "deal_id@in": `(${dealIds.join(",")})` }
      : { "deal_id@eq": -1 };

  const { total: payments = 0 } = useGetList(
    "deal_client_payments",
    countQuery("deal_client_payments", paymentsFilter),
    { staleTime, enabled: enabled && dealIds.length > 0 },
  );

  const { data: companyContacts = [] } = useGetList<Contact>(
    "contacts",
    {
      filter: { "company_id@eq": companyId },
      pagination: { page: 1, perPage: 200 },
      sort: { field: "id", order: "ASC" },
    },
    { staleTime, enabled },
  );

  const contactIds = companyContacts.map((contact) => contact.id);
  const contactFilter =
    contactIds.length > 0
      ? { "contact_id@in": `(${contactIds.join(",")})` }
      : { "contact_id@eq": -1 };

  const { total: tasks = 0 } = useGetList(
    "tasks",
    countQuery("tasks", { ...contactFilter, ...TASK_STATUS_FILTERS.open }),
    { staleTime, enabled: enabled && contactIds.length > 0 },
  );
  const { total: notes = 0 } = useGetList(
    "contact_notes",
    countQuery("contact_notes", contactFilter),
    { staleTime, enabled: enabled && contactIds.length > 0 },
  );

  return {
    contacts,
    projects,
    proposals,
    contracts,
    tickets,
    tasks,
    notes,
    webForms,
    payments,
    contactIds: contactIds as Identifier[],
  };
};
