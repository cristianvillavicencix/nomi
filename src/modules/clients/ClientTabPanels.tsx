import { useMemo, useState } from "react";
import { FileText } from "lucide-react";
import { Link } from "react-router";
import { useGetList, type Identifier } from "ra-core";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { AddTask } from "@/components/atomic-crm/tasks/AddTask";
import { ContactCalendarEventsSection } from "@/modules/calendar/ProjectCalendarEventsList";
import {
  TASK_STATUS_FILTERS,
  type TaskStatusFilter,
} from "@/components/atomic-crm/tasks/taskConstants";
import { TaskTable } from "@/components/atomic-crm/tasks/TaskTable";
import { Note } from "@/components/atomic-crm/notes/Note";
import { NoteCreate } from "@/components/atomic-crm/notes";
import { findDealLabel } from "@/components/atomic-crm/deals/deal";
import { useConfigurationContext } from "@/components/atomic-crm/root/ConfigurationContext";
import type { Company, Contact, ContactNote, Deal } from "@/components/atomic-crm/types";
import type {
  ClientInvoice,
  Contract,
  Proposal,
  Ticket,
} from "@/modules/types";
import { formatBillingDate } from "@/modules/billing/billingDisplayUtils";
import {
  invoiceStatusSidebarLabel,
  invoiceStatusSidebarVariant,
} from "@/modules/billing/invoiceStatusSidebarLabel";
import type { FormSubmissionV2 } from "@/modules/forms/types";
import { ClientTabEmpty } from "@/modules/clients/ClientContactsTab";
import { formatDateTime } from "@/modules/clients/clientShowUtils";
import { clientTableWrapperClassName } from "@/modules/clients/ClientTabSectionCard";
import { MoneyText } from "@/lib/permissions/MoneyText";
import { isPipelineTransitionNote } from "@/modules/leads/leadFollowUpUtils";
import { PipelineUpdateBadge } from "@/modules/shared/ContactActivityFeed";
import { buildOpenDealsFilter } from "@/modules/deals/openDealFilters";
import { ClientTicketsHub } from "@/modules/tickets/ClientTicketsHub";
import type { ClientTicketScope } from "@/modules/tickets/clientTicketScope";

const TabLoading = () => (
  <div className="space-y-2">
    <Skeleton className="h-10 w-full" />
    <Skeleton className="h-10 w-full" />
    <Skeleton className="h-10 w-full" />
  </div>
);

export const ClientProjectsTab = ({
  companyId,
  contactId,
}: {
  companyId?: Company["id"];
  contactId?: Company["id"];
}) => {
  const { dealStages } = useConfigurationContext();
  const filter = contactId
    ? { "contact_ids@cs": `{${contactId}}` }
    : { "company_id@eq": companyId };

  const { data: deals = [], isPending } = useGetList<Deal>(
    "deals",
    {
      filter,
      pagination: { page: 1, perPage: 100 },
      sort: { field: "updated_at", order: "DESC" },
    },
    { staleTime: 30_000, enabled: !!(contactId ?? companyId) },
  );

  if (isPending) return <TabLoading />;

  if (deals.length === 0) {
    return (
      <ClientTabEmpty
        message={
          contactId
            ? "No projects linked to this contact yet."
            : "No projects for this client yet. Use the + button above to create one."
        }
      />
    );
  }

  return (
    <div className={clientTableWrapperClassName}>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Project</TableHead>
            <TableHead>Stage</TableHead>
            <TableHead className="hidden md:table-cell">Amount</TableHead>
            <TableHead className="hidden lg:table-cell">Updated</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {deals.map((deal) => (
            <TableRow key={deal.id}>
              <TableCell>
                <Link
                  to={`/deals/${deal.id}/show`}
                  className="link-action font-medium"
                >
                  {deal.name}
                </Link>
              </TableCell>
              <TableCell className="text-muted-foreground">
                {findDealLabel(dealStages, deal.stage)}
              </TableCell>
              <TableCell className="hidden md:table-cell text-muted-foreground">
                <MoneyText value={deal.amount} />
              </TableCell>
              <TableCell className="hidden lg:table-cell text-muted-foreground">
                {formatDateTime(deal.updated_at)}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
};

export const ClientOpenDealsTab = ({
  companyId,
  contactId,
}: {
  companyId?: Company["id"];
  contactId?: Company["id"];
}) => {
  const { dealStages, dealPipelineStatuses } = useConfigurationContext();
  const baseFilter = contactId
    ? { "contact_ids@cs": `{${contactId}}` }
    : { "company_id@eq": companyId };
  const filter = buildOpenDealsFilter(
    dealPipelineStatuses,
    dealStages,
    baseFilter,
  );

  const { data: deals = [], isPending } = useGetList<Deal>(
    "deals",
    {
      filter,
      pagination: { page: 1, perPage: 100 },
      sort: { field: "updated_at", order: "DESC" },
    },
    { staleTime: 30_000, enabled: !!(contactId ?? companyId) },
  );

  if (isPending) return <TabLoading />;

  if (deals.length === 0) {
    return (
      <ClientTabEmpty
        message={
          contactId
            ? "No open deals linked to this contact yet."
            : "No open deals for this company yet."
        }
      />
    );
  }

  return (
    <div className={clientTableWrapperClassName}>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Deal</TableHead>
            <TableHead>Stage</TableHead>
            <TableHead className="hidden md:table-cell">Amount</TableHead>
            <TableHead className="hidden lg:table-cell">Updated</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {deals.map((deal) => (
            <TableRow key={deal.id}>
              <TableCell>
                <Link
                  to={`/deals/${deal.id}/show`}
                  className="link-action font-medium"
                >
                  {deal.name}
                </Link>
              </TableCell>
              <TableCell className="text-muted-foreground">
                {findDealLabel(dealStages, deal.stage)}
              </TableCell>
              <TableCell className="hidden md:table-cell text-muted-foreground">
                <MoneyText value={deal.amount} />
              </TableCell>
              <TableCell className="hidden lg:table-cell text-muted-foreground">
                {formatDateTime(deal.updated_at)}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
};

export const ClientInvoicesTab = ({
  companyId,
}: {
  companyId: Company["id"];
}) => {
  const { data = [], isLoading } = useGetList<ClientInvoice>(
    "client_invoices",
    {
      filter: { "company_id@eq": companyId },
      pagination: { page: 1, perPage: 50 },
      sort: { field: "issue_date", order: "DESC" },
    },
    { staleTime: 30_000 },
  );

  if (isLoading) return <TabLoading />;

  if (data.length === 0) {
    return (
      <ClientTabEmpty message="No invoices for this client yet. Ticket invoices and standalone invoices appear here once created." />
    );
  }

  return (
    <div className={clientTableWrapperClassName}>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Invoice #</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="hidden md:table-cell">Issue date</TableHead>
            <TableHead className="hidden lg:table-cell">Ticket</TableHead>
            <TableHead className="text-right">Amount</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {data.map((invoice) => (
            <TableRow key={invoice.id}>
              <TableCell>
                <Link
                  to={`/billing/invoices/${invoice.id}/show`}
                  className="link-action font-medium"
                >
                  {invoice.invoice_number}
                </Link>
              </TableCell>
              <TableCell>
                <Badge
                  variant={invoiceStatusSidebarVariant(
                    invoice.status,
                    invoice.due_date,
                  )}
                  className="capitalize"
                >
                  {invoiceStatusSidebarLabel(invoice.status, invoice.due_date)}
                </Badge>
              </TableCell>
              <TableCell className="hidden text-muted-foreground md:table-cell">
                {formatBillingDate(invoice.issue_date)}
              </TableCell>
              <TableCell className="hidden lg:table-cell">
                {invoice.ticket_id ? (
                  <Link
                    to={`/tickets/${invoice.ticket_id}/show`}
                    className="link-action"
                  >
                    Ticket #{invoice.ticket_id}
                  </Link>
                ) : (
                  "—"
                )}
              </TableCell>
              <TableCell className="text-right text-muted-foreground">
                <MoneyText value={invoice.amount} />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
};

export const ClientProposalsTab = ({
  companyId,
}: {
  companyId: Company["id"];
}) => {
  const { data = [], isPending } = useGetList<Proposal>(
    "proposals",
    {
      filter: { "company_id@eq": companyId },
      pagination: { page: 1, perPage: 50 },
      sort: { field: "updated_at", order: "DESC" },
    },
    { staleTime: 30_000 },
  );

  if (isPending) return <TabLoading />;

  if (data.length === 0) {
    return (
      <ClientTabEmpty message="No proposals for this client yet. Use the + button above to create one." />
    );
  }

  return (
    <div className={clientTableWrapperClassName}>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Title</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="text-right">Amount</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {data.map((proposal) => (
            <TableRow key={proposal.id}>
              <TableCell>
                <Link
                  to={`/proposals/${proposal.id}/show`}
                  className="link-action font-medium"
                >
                  {proposal.title}
                </Link>
              </TableCell>
              <TableCell>
                {proposal.status ? (
                  <Badge variant="outline" className="capitalize">
                    {proposal.status.replace(/-/g, " ")}
                  </Badge>
                ) : (
                  "—"
                )}
              </TableCell>
              <TableCell className="text-right text-muted-foreground">
                {proposal.amount != null ? (
                  <MoneyText value={proposal.amount} />
                ) : (
                  "—"
                )}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
};

export const ClientContractsTab = ({
  companyId,
}: {
  companyId: Company["id"];
}) => {
  const { data = [], isPending } = useGetList<Contract>(
    "contracts",
    {
      filter: { "company_id@eq": companyId },
      pagination: { page: 1, perPage: 50 },
      sort: { field: "updated_at", order: "DESC" },
    },
    { staleTime: 30_000 },
  );

  if (isPending) return <TabLoading />;

  if (data.length === 0) {
    return <ClientTabEmpty message="No contracts for this client yet." />;
  }

  return (
    <div className={clientTableWrapperClassName}>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Title</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="hidden md:table-cell">Updated</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {data.map((contract) => (
            <TableRow key={contract.id}>
              <TableCell>
                <Link
                  to={`/contracts/${contract.id}/show`}
                  className="link-action font-medium"
                >
                  {contract.title}
                </Link>
              </TableCell>
              <TableCell>
                {contract.status ? (
                  <Badge variant="outline" className="capitalize">
                    {contract.status.replace(/-/g, " ")}
                  </Badge>
                ) : (
                  "—"
                )}
              </TableCell>
              <TableCell className="hidden md:table-cell text-muted-foreground">
                {formatDateTime(contract.updated_at)}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
};

export const ClientTicketsTab = ({
  companyId,
  contactId,
  scope = "company",
}: {
  companyId?: Company["id"];
  contactId?: Contact["id"];
  scope?: ClientTicketScope;
}) => (
  <ClientTicketsHub
    companyId={companyId}
    contactId={contactId}
    scope={scope}
  />
);

export const ClientSupportTab = ({
  companyId,
}: {
  companyId: Company["id"];
}) => (
  <div className="space-y-8">
    <section className="space-y-3">
      <h3 className="text-base font-semibold">Tickets</h3>
      <ClientTicketsTab companyId={companyId} />
    </section>
    <section className="space-y-3">
      <h3 className="text-base font-semibold">Form submissions</h3>
      <ClientWebFormsTab companyId={companyId} />
    </section>
  </div>
);

export const ClientWebFormsTab = ({
  companyId,
}: {
  companyId: Company["id"];
}) => {
  const { data = [], isPending } = useGetList<FormSubmissionV2>(
    "form_submissions_v2",
    {
      filter: { "company_id@eq": companyId },
      pagination: { page: 1, perPage: 50 },
      sort: { field: "submitted_at", order: "DESC" },
    },
    { staleTime: 30_000 },
  );

  if (isPending) return <TabLoading />;

  if (data.length === 0) {
    return (
      <ClientTabEmpty message="No form submissions linked to this client yet." />
    );
  }

  return (
    <div className={clientTableWrapperClassName}>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Submission</TableHead>
            <TableHead className="hidden md:table-cell">Summary</TableHead>
            <TableHead>Submitted</TableHead>
            <TableHead className="text-right">Detail</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {data.map((submission) => (
            <TableRow key={submission.id}>
              <TableCell className="font-medium">#{submission.id}</TableCell>
              <TableCell className="hidden max-w-md truncate md:table-cell text-muted-foreground">
                {summarizeSubmission(submission.answers)}
              </TableCell>
              <TableCell className="text-muted-foreground">
                {formatDateTime(submission.submitted_at)}
              </TableCell>
              <TableCell className="text-right">
                <Link
                  to={`/forms-v2/submissions/${submission.id}`}
                  className="link-action text-sm"
                >
                  View
                </Link>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
};

export const ClientFilesTab = ({ companyId }: { companyId: Company["id"] }) => {
  const { data: deals = [], isPending } = useGetList<Deal>(
    "deals",
    {
      filter: { "company_id@eq": companyId },
      pagination: { page: 1, perPage: 20 },
      sort: { field: "updated_at", order: "DESC" },
    },
    { staleTime: 30_000 },
  );

  if (isPending) return <TabLoading />;

  if (deals.length === 0) {
    return (
      <ClientTabEmpty message="Project files will appear here once projects are created." />
    );
  }

  return (
    <div className={clientTableWrapperClassName}>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Project</TableHead>
            <TableHead className="text-right">Resources</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {deals.map((deal) => (
            <TableRow key={deal.id}>
              <TableCell className="font-medium">{deal.name}</TableCell>
              <TableCell className="text-right">
                <Link
                  to={`/deals/${deal.id}/show?tab=resources`}
                  className="link-action inline-flex items-center gap-1 text-sm"
                >
                  <FileText className="size-4" />
                  Open resources
                </Link>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
};

export const ClientTasksTab = ({
  contactIds,
  primaryContactId,
}: {
  companyId?: Company["id"];
  contactIds: Identifier[];
  primaryContactId?: Identifier | null;
}) => {
  const [status, setStatus] = useState<TaskStatusFilter>("open");
  const showContactColumn = contactIds.length > 1;

  const filter = useMemo(() => {
    const contactFilter =
      contactIds.length > 0
        ? { "contact_id@in": `(${contactIds.join(",")})` }
        : { "contact_id@eq": -1 };
    return {
      ...contactFilter,
      ...TASK_STATUS_FILTERS[status],
    };
  }, [contactIds, status]);

  const contactFilter =
    contactIds.length > 0
      ? { "id@in": `(${contactIds.join(",")})` }
      : undefined;

  const { data: tasks = [], isPending } = useGetList(
    "tasks",
    {
      filter,
      pagination: { page: 1, perPage: 100 },
      sort: {
        field: status === "done" ? "done_date" : "due_date",
        order: status === "done" ? "DESC" : "ASC",
      },
    },
    { staleTime: 30_000, enabled: contactIds.length > 0 },
  );

  if (isPending) return <TabLoading />;

  if (contactIds.length === 0) {
    return (
      <ClientTabEmpty message="Add a contact to this client before creating tasks." />
    );
  }

  return (
    <div className="space-y-4">
      {primaryContactId ? (
        <AddTask contactId={primaryContactId} display="chip" />
      ) : (
        <AddTask selectContact contactFilter={contactFilter} display="chip" />
      )}

      <div
        className="inline-flex h-auto w-max justify-start gap-1 rounded-lg bg-muted p-1"
        role="tablist"
      >
        {(
          [
            { value: "open", label: "Open" },
            { value: "done", label: "Done" },
          ] as const
        ).map((option) => {
          const active = status === option.value;
          return (
            <button
              key={option.value}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => setStatus(option.value)}
              className={cn(
                "inline-flex h-8 shrink-0 items-center justify-center rounded-md border border-transparent px-3 text-sm font-medium whitespace-nowrap transition-[color,box-shadow]",
                active
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {option.label}
            </button>
          );
        })}
      </div>

      <ContactCalendarEventsSection
        contactIds={contactIds}
        showCompleted={status === "done"}
        title={status === "done" ? "Completed events" : "Upcoming events"}
      />

      <TaskTable
        tasks={tasks}
        showContact={showContactColumn}
        showProject
        emptyMessage={
          status === "done"
            ? "No completed tasks for this client's contacts yet."
            : "No open tasks for this client's contacts yet."
        }
      />
    </div>
  );
};

export const ClientNotesTab = ({
  contactIds,
  primaryContactId,
}: {
  contactIds: Identifier[];
  primaryContactId?: Identifier | null;
}) => {
  const filter =
    contactIds.length > 0
      ? { "contact_id@in": `(${contactIds.join(",")})` }
      : { "contact_id@eq": -1 };

  const { data: notes = [], isPending } = useGetList<ContactNote>(
    "contact_notes",
    {
      filter,
      pagination: { page: 1, perPage: 50 },
      sort: { field: "date", order: "DESC" },
    },
    { staleTime: 30_000, enabled: contactIds.length > 0 },
  );

  if (isPending) return <TabLoading />;

  return (
    <div className="space-y-4">
      {primaryContactId ? (
        <NoteCreate
          reference="contacts"
          showStatus
          contactId={primaryContactId}
        />
      ) : null}
      {contactIds.length === 0 || notes.length === 0 ? (
        <ClientTabEmpty message="No notes for this client's contacts yet." />
      ) : (
        <div className="space-y-3">
          {notes.map((note) => (
            <div key={note.id} className="space-y-2">
              {isPipelineTransitionNote(note) ? (
                <div className="flex justify-end">
                  <PipelineUpdateBadge />
                </div>
              ) : null}
              <Note note={note} resource="contact_notes" />
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

const summarizeSubmission = (data?: Record<string, unknown>) => {
  if (!data) return "—";
  const values = Object.values(data)
    .map((value) => String(value ?? "").trim())
    .filter(Boolean);
  return values.slice(0, 3).join(" · ") || "—";
};
