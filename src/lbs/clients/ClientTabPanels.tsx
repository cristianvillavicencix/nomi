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
import { ContactCalendarEventsSection } from "@/lbs/calendar/ProjectCalendarEventsList";
import {
  TASK_STATUS_FILTERS,
  type TaskStatusFilter,
} from "@/components/atomic-crm/tasks/taskConstants";
import { TaskTable } from "@/components/atomic-crm/tasks/TaskTable";
import { Note } from "@/components/atomic-crm/notes/Note";
import { NoteCreate } from "@/components/atomic-crm/notes";
import { findDealLabel } from "@/components/atomic-crm/deals/deal";
import { useConfigurationContext } from "@/components/atomic-crm/root/ConfigurationContext";
import type { Company, ContactNote, Deal } from "@/components/atomic-crm/types";
import type { Contract, Proposal, Ticket } from "@/lbs/types";
import type { FormSubmissionV2 } from "@/lbs/forms-v2/types";
import { ClientTabEmpty } from "@/lbs/clients/ClientContactsTab";
import { formatDateTime } from "@/lbs/clients/clientShowUtils";
import { clientTableWrapperClassName } from "@/lbs/clients/ClientTabSectionCard";
import { MoneyText } from "@/lib/permissions/MoneyText";
import { isPipelineTransitionNote } from "@/lbs/leads/leadFollowUpUtils";
import { PipelineUpdateBadge } from "@/lbs/shared/ContactActivityFeed";

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
}: {
  companyId: Company["id"];
}) => {
  const { data = [], isPending } = useGetList<Ticket>(
    "tickets",
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
      <ClientTabEmpty message="No support tickets for this client yet. Use the + button above to create one." />
    );
  }

  return (
    <div className={clientTableWrapperClassName}>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Subject</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="hidden md:table-cell">Priority</TableHead>
            <TableHead className="hidden lg:table-cell">Updated</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {data.map((ticket) => (
            <TableRow key={ticket.id}>
              <TableCell>
                <Link
                  to={`/tickets/${ticket.id}/show`}
                  className="link-action font-medium"
                >
                  {ticket.subject ?? `Ticket #${ticket.id}`}
                </Link>
              </TableCell>
              <TableCell>
                {ticket.status ? (
                  <Badge variant="outline" className="capitalize">
                    {ticket.status.replace(/_/g, " ")}
                  </Badge>
                ) : (
                  "—"
                )}
              </TableCell>
              <TableCell className="hidden md:table-cell capitalize text-muted-foreground">
                {ticket.priority || "—"}
              </TableCell>
              <TableCell className="hidden lg:table-cell text-muted-foreground">
                {formatDateTime(ticket.updated_at)}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
};

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
              <Note note={note} />
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
