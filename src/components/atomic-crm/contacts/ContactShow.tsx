import { formatDistanceToNow } from "date-fns";
import {
  BriefcaseBusiness,
  CircleDollarSign,
  FileText,
  FolderKanban,
  ListChecks,
  ReceiptText,
  UserRoundPlus,
} from "lucide-react";
import { useMemo, useState } from "react";
import {
  RecordRepresentation,
  ResourceContextProvider,
  ShowBase,
  useGetList,
  useGetMany,
  useShowContext,
} from "ra-core";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useIsMobile } from "@/hooks/use-mobile";
import { cn } from "@/lib/utils";
import { Link, useLocation, useSearchParams } from "react-router";

import MobileHeader from "../layout/MobileHeader";
import { MobileContent } from "../layout/MobileContent";
import { MobileBackButton } from "../misc/MobileBackButton";
import { RelativeDate } from "../misc/RelativeDate";
import { NoteCreate } from "../notes";
import { Note } from "../notes/Note";
import type {
  Company,
  Contact,
  ContactNote,
  Deal,
  Payment,
  PaymentLine,
  Task,
} from "../types";
import { ContactEditModal } from "./ContactEditModal";
import { ContactHeader } from "./ContactHeader";

const CONTACT_TABS = ["activities", "projects", "financials"] as const;
type ContactTab = (typeof CONTACT_TABS)[number];

type ActivityFeedItem =
  | { id: string; type: "note"; date: string; note: ContactNote }
  | { id: string; type: "task"; date: string; task: Task }
  | { id: string; type: "created"; date: string };

export const ContactShow = () => {
  const isMobile = useIsMobile();

  return (
    <ShowBase
      queryOptions={{
        onError: isMobile
          ? () => {
              /** disable mobile error notification as content handles empty states */
            }
          : undefined,
      }}
    >
      {isMobile ? <ContactShowContentMobile /> : <ContactShowContent />}
    </ShowBase>
  );
};

const ContactShowContentMobile = () => {
  const { record, isPending } = useShowContext<Contact>();
  const [editOpen, setEditOpen] = useState(false);
  const location = useLocation();

  if (isPending || !record) return null;

  return (
    <>
      <ContactEditModal
        open={editOpen}
        onOpenChange={setEditOpen}
        contactId={record.id}
      />
      <MobileHeader>
        <MobileBackButton />
        <div className="flex flex-1 min-w-0">
          <Link to="/contacts" className="flex-1 min-w-0">
            <h1 className="truncate text-xl font-semibold">
              <RecordRepresentation />
            </h1>
          </Link>
        </div>
      </MobileHeader>
      <MobileContent>
        <ContactHeader
          record={record}
          locationSearch={location.search}
          onEdit={() => setEditOpen(true)}
          isMobile
        />
        <Card>
          <CardContent>
            <ContactMainTabs record={record} />
          </CardContent>
        </Card>
      </MobileContent>
    </>
  );
};

const ContactShowContent = () => {
  const { record, isPending } = useShowContext<Contact>();
  const location = useLocation();
  const [editOpen, setEditOpen] = useState(false);

  if (isPending || !record) return null;

  return (
    <div className="mt-2 mb-2">
      <ContactEditModal
        open={editOpen}
        onOpenChange={setEditOpen}
        contactId={record.id}
      />
      <div className="space-y-4">
        <ContactHeader
          record={record}
          locationSearch={location.search}
          onEdit={() => setEditOpen(true)}
        />
        <Card>
          <CardContent>
            <ContactMainTabs record={record} />
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

const ContactMainTabs = ({ record }: { record: Contact }) => {
  const [searchParams, setSearchParams] = useSearchParams();
  const currentTab = getValidTab(searchParams.get("tab"));
  const { total: projectsCount } = useGetList<Deal>(
    "deals",
    {
      filter: { "contact_ids@cs": `{${record.id}}` },
      pagination: { page: 1, perPage: 1 },
      sort: { field: "updated_at", order: "DESC" },
    },
    { staleTime: 30_000 },
  );

  const handleTabChange = (tab: string) => {
    const nextTab = getValidTab(tab);
    const nextSearchParams = new URLSearchParams(searchParams);
    nextSearchParams.set("tab", nextTab);
    setSearchParams(nextSearchParams, { replace: true });
  };

  return (
    <Tabs value={currentTab} onValueChange={handleTabChange} className="w-full">
      <TabsList className="grid h-10 w-full grid-cols-3">
        <TabsTrigger value="activities">Activities</TabsTrigger>
        <TabsTrigger value="projects">
          Projects{typeof projectsCount === "number" ? ` (${projectsCount})` : ""}
        </TabsTrigger>
        <TabsTrigger value="financials">Financials</TabsTrigger>
      </TabsList>

      <TabsContent value="activities" className="pt-4">
        <ContactActivitiesTab record={record} />
      </TabsContent>

      <TabsContent value="projects" className="pt-4">
        <ContactProjectsTab record={record} />
      </TabsContent>

      <TabsContent value="financials" className="pt-4">
        <ContactFinancialsTab record={record} />
      </TabsContent>
    </Tabs>
  );
};

const ContactActivitiesTab = ({ record }: { record: Contact }) => {
  const { data: notes, isPending: notesPending } = useGetList<ContactNote>(
    "contact_notes",
    {
      filter: { "contact_id@eq": record.id },
      sort: { field: "date", order: "DESC" },
      pagination: { page: 1, perPage: 50 },
    },
  );
  const { data: tasks, isPending: tasksPending } = useGetList<Task>(
    "tasks",
    {
      filter: { "contact_id@eq": record.id },
      sort: { field: "due_date", order: "DESC" },
      pagination: { page: 1, perPage: 50 },
    },
  );

  const events = useMemo<ActivityFeedItem[]>(() => {
    const noteEvents =
      notes?.map((note) => ({
        id: `note-${note.id}`,
        type: "note" as const,
        date: note.date,
        note,
      })) ?? [];
    const taskEvents =
      tasks?.map((task) => ({
        id: `task-${task.id}`,
        type: "task" as const,
        date: task.done_date ?? task.due_date,
        task,
      })) ?? [];
    const createdEvent: ActivityFeedItem[] = record.first_seen
      ? [
          {
            id: `created-${record.id}`,
            type: "created",
            date: record.first_seen,
          },
        ]
      : [];

    return [...noteEvents, ...taskEvents, ...createdEvent].sort(
      (left, right) =>
        new Date(right.date).getTime() - new Date(left.date).getTime(),
    );
  }, [notes, record.first_seen, record.id, tasks]);

  if (notesPending || tasksPending) {
    return <TabEmptyState label="Loading activity..." />;
  }

  return (
    <div className="space-y-4">
      <NoteCreate reference="contacts" showStatus contactId={record.id} />
      {events.length === 0 ? (
        <TabEmptyState label="No activity yet for this contact." />
      ) : (
        <div className="space-y-4">
          {events.map((event) => (
            <ActivityFeedRow key={event.id} event={event} />
          ))}
        </div>
      )}
    </div>
  );
};

const ActivityFeedRow = ({ event }: { event: ActivityFeedItem }) => {
  if (event.type === "note") {
    return (
      <div className="rounded-lg border border-border p-4">
        <div className="mb-3 flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
          <FileText className="size-4" />
          Note
          <span className="normal-case tracking-normal">
            <RelativeDate date={event.date} />
          </span>
        </div>
        <ResourceContextProvider value="contact_notes">
          <Note note={event.note} showStatus />
        </ResourceContextProvider>
      </div>
    );
  }

  if (event.type === "task") {
    return (
      <div className="rounded-lg border border-border p-4">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="mb-1 flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
              <ListChecks className="size-4" />
              {event.task.done_date ? "Task completed" : "Task scheduled"}
            </div>
            <p className="text-sm font-medium">{event.task.text}</p>
            <p className="mt-1 text-sm text-muted-foreground">
              {event.task.type !== "None" && event.task.type !== "none"
                ? `${event.task.type} · `
                : ""}
              {event.task.done_date ? "Completed" : "Due"}{" "}
              {formatDistanceToNow(new Date(event.date), {
                addSuffix: true,
              })}
            </p>
          </div>
          <span className="text-xs text-muted-foreground whitespace-nowrap">
            <RelativeDate date={event.date} />
          </span>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-dashed border-border p-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="mb-1 flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
            <UserRoundPlus className="size-4" />
            Contact created
          </div>
          <p className="text-sm text-muted-foreground">
            This contact was added{" "}
            {formatDistanceToNow(new Date(event.date), { addSuffix: true })}.
          </p>
        </div>
        <span className="text-xs text-muted-foreground whitespace-nowrap">
          <RelativeDate date={event.date} />
        </span>
      </div>
    </div>
  );
};

const ContactProjectsTab = ({ record }: { record: Contact }) => {
  const { data: deals, isPending, error } = useGetList<Deal>("deals", {
    filter: { "contact_ids@cs": `{${record.id}}` },
    sort: { field: "updated_at", order: "DESC" },
    pagination: { page: 1, perPage: 50 },
  });
  const companyIds = useMemo(
    () => Array.from(new Set((deals ?? []).map((deal) => deal.company_id))),
    [deals],
  );
  const { data: companies } = useGetMany<Company>(
    "companies",
    { ids: companyIds },
    { enabled: companyIds.length > 0 },
  );

  const companiesById = useMemo(
    () =>
      Object.fromEntries((companies ?? []).map((company) => [company.id, company])),
    [companies],
  );

  if (isPending) {
    return <TabEmptyState label="Loading projects..." />;
  }

  if (error || !deals?.length) {
    return (
      <div className="space-y-4">
        <ProjectsTabHeader />
        <TabEmptyState label="No projects linked to this contact yet." />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <ProjectsTabHeader />
      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="min-w-full text-sm">
          <thead className="bg-muted/50 text-muted-foreground">
            <tr>
              <th className="px-4 py-3 text-left font-medium">Project Name</th>
              <th className="px-4 py-3 text-left font-medium">Status</th>
              <th className="px-4 py-3 text-left font-medium">Start Date</th>
              <th className="px-4 py-3 text-left font-medium">Value</th>
              <th className="px-4 py-3 text-left font-medium">Company</th>
            </tr>
          </thead>
          <tbody>
            {deals.map((deal) => (
              <tr
                key={deal.id}
                className="border-t border-border hover:bg-muted/30 transition-colors"
              >
                <td className="px-4 py-3">
                  <Link to={`/deals/${deal.id}/show`} className="link-action font-medium">
                    {deal.name}
                  </Link>
                </td>
                <td className="px-4 py-3 text-muted-foreground">{deal.stage}</td>
                <td className="px-4 py-3 text-muted-foreground">
                  {deal.created_at ? new Date(deal.created_at).toLocaleDateString() : "—"}
                </td>
                <td className="px-4 py-3">{formatCurrency(deal.amount)}</td>
                <td className="px-4 py-3 text-muted-foreground">
                  {companiesById[deal.company_id]?.name ?? "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

const ProjectsTabHeader = () => (
  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
    <div>
      <h3 className="text-lg font-semibold">Projects</h3>
      <p className="text-sm text-muted-foreground">
        Projects linked to this contact.
      </p>
    </div>
    <Button asChild>
      <Link to="/deals/create">
        <FolderKanban className="size-4" />
        Create Project
      </Link>
    </Button>
  </div>
);

const ContactFinancialsTab = ({ record }: { record: Contact }) => {
  const { data: deals, isPending: dealsPending } = useGetList<Deal>("deals", {
    filter: { "contact_ids@cs": `{${record.id}}` },
    sort: { field: "updated_at", order: "DESC" },
    pagination: { page: 1, perPage: 100 },
  });
  const dealIds = useMemo(() => (deals ?? []).map((deal) => deal.id), [deals]);
  const { data: paymentLines, isPending: linesPending } = useGetList<PaymentLine>(
    "payment_lines",
    {
      filter:
        dealIds.length > 0
          ? { "project_id@in": `(${dealIds.join(",")})` }
          : { "project_id@in": "(-1)" },
      sort: { field: "created_at", order: "DESC" },
      pagination: { page: 1, perPage: 200 },
    },
    { enabled: dealIds.length > 0 },
  );

  const paymentIds = useMemo(
    () =>
      Array.from(
        new Set((paymentLines ?? []).map((line) => line.payment_id).filter(Boolean)),
      ),
    [paymentLines],
  );
  const { data: payments } = useGetMany<Payment>(
    "payments",
    { ids: paymentIds },
    { enabled: paymentIds.length > 0 },
  );

  const dealsById = useMemo(
    () => Object.fromEntries((deals ?? []).map((deal) => [deal.id, deal])),
    [deals],
  );
  const paymentsById = useMemo(
    () => Object.fromEntries((payments ?? []).map((payment) => [payment.id, payment])),
    [payments],
  );

  const paymentRows = useMemo(() => {
    const rows = new Map<
      string,
      {
        payment: Payment;
        amount: number;
        projectNames: string[];
        notes: string[];
      }
    >();

    (paymentLines ?? []).forEach((line) => {
      const payment = paymentsById[line.payment_id];
      if (!payment) return;

      const existing = rows.get(String(line.payment_id)) ?? {
        payment,
        amount: 0,
        projectNames: [],
        notes: [],
      };
      existing.amount += Number(line.amount ?? 0);

      const projectName = line.project_id ? dealsById[line.project_id]?.name : undefined;
      if (projectName && !existing.projectNames.includes(projectName)) {
        existing.projectNames.push(projectName);
      }
      if (line.notes) {
        existing.notes.push(line.notes);
      }

      rows.set(String(line.payment_id), existing);
    });

    return Array.from(rows.values()).sort(
      (left, right) =>
        new Date(right.payment.pay_date).getTime() -
        new Date(left.payment.pay_date).getTime(),
    );
  }, [dealsById, paymentLines, paymentsById]);

  const totalInvoiced = useMemo(
    () => (deals ?? []).reduce((sum, deal) => sum + Number(deal.amount ?? 0), 0),
    [deals],
  );
  const totalPaid = useMemo(
    () => paymentRows.reduce((sum, row) => sum + row.amount, 0),
    [paymentRows],
  );
  const balance = totalInvoiced - totalPaid;

  if (dealsPending || linesPending) {
    return <TabEmptyState label="Loading financials..." />;
  }

  if (!dealIds.length) {
    return <TabEmptyState label="No project financials available for this contact." />;
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-3 md:grid-cols-4">
        <SummaryCard
          label="Total Invoiced"
          value={formatCurrency(totalInvoiced)}
          icon={BriefcaseBusiness}
        />
        <SummaryCard
          label="Total Paid"
          value={formatCurrency(totalPaid)}
          icon={CircleDollarSign}
        />
        <SummaryCard
          label="Balance"
          value={formatCurrency(balance)}
          icon={ReceiptText}
        />
        <SummaryCard
          label="# Payments"
          value={String(paymentRows.length)}
          icon={ListChecks}
        />
      </div>

      {paymentRows.length === 0 ? (
        <TabEmptyState label="No payments tied to this contact's projects yet." />
      ) : (
        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="min-w-full text-sm">
            <thead className="bg-muted/50 text-muted-foreground">
              <tr>
                <th className="px-4 py-3 text-left font-medium">Date</th>
                <th className="px-4 py-3 text-left font-medium">Project</th>
                <th className="px-4 py-3 text-left font-medium">Amount</th>
                <th className="px-4 py-3 text-left font-medium">Method</th>
                <th className="px-4 py-3 text-left font-medium">Reference / Notes</th>
                <th className="px-4 py-3 text-left font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {paymentRows.map((row) => (
                <tr
                  key={row.payment.id}
                  className="border-t border-border hover:bg-muted/30 transition-colors"
                >
                  <td className="px-4 py-3">
                    <Link
                      to={`/payments/${row.payment.id}/show`}
                      className="link-action font-medium"
                    >
                      {new Date(row.payment.pay_date).toLocaleDateString()}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {row.projectNames.join(", ") || "—"}
                  </td>
                  <td className="px-4 py-3">{formatCurrency(row.amount)}</td>
                  <td className="px-4 py-3 text-muted-foreground">—</td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {row.notes[0] ?? "—"}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={cn(
                        "rounded-full px-2 py-1 text-xs font-medium",
                        row.payment.status === "paid"
                          ? "bg-emerald-100 text-emerald-700"
                          : row.payment.status === "approved"
                            ? "bg-blue-100 text-blue-700"
                            : "bg-amber-100 text-amber-700",
                      )}
                    >
                      {row.payment.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

const SummaryCard = ({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value: string;
  icon: typeof CircleDollarSign;
}) => (
  <div className="rounded-lg border border-border p-4">
    <div className="mb-2 flex items-center gap-2 text-muted-foreground">
      <Icon className="size-4" />
      <span className="text-xs font-medium uppercase tracking-wide">{label}</span>
    </div>
    <div className="text-lg font-semibold">{value}</div>
  </div>
);

const TabEmptyState = ({ label }: { label: string }) => (
  <div className="rounded-lg border border-dashed border-border px-4 py-8 text-center text-sm text-muted-foreground">
    {label}
  </div>
);

const getValidTab = (value: string | null): ContactTab =>
  CONTACT_TABS.includes(value as ContactTab)
    ? (value as ContactTab)
    : "activities";

const formatCurrency = (value: number | null | undefined) =>
  Number(value ?? 0).toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
  });
