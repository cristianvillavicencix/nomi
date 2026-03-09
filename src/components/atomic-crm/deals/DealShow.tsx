import { useMutation } from "@tanstack/react-query";
import { format, isValid } from "date-fns";
import { Archive, ArchiveRestore, ArrowLeft } from "lucide-react";
import { useMemo, useState } from "react";
import {
  ShowBase,
  useGetList,
  useGetMany,
  useNotify,
  useRecordContext,
  useRedirect,
  useRefresh,
  useUpdate,
} from "ra-core";
import { DeleteButton } from "@/components/admin/delete-button";
import { EditButton } from "@/components/admin/edit-button";
import { ReferenceArrayField } from "@/components/admin/reference-array-field";
import { ReferenceField } from "@/components/admin/reference-field";
import { ReferenceManyField } from "@/components/admin/reference-many-field";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Link } from "react-router";

import { CompanyAvatar } from "../companies/CompanyAvatar";
import { NoteCreate } from "../notes/NoteCreate";
import { NotesIterator } from "../notes/NotesIterator";
import { useConfigurationContext } from "../root/ConfigurationContext";
import type {
  Deal,
  DealNote,
  Payment,
  PaymentLine,
  Person,
  TimeEntry,
} from "../types";
import { ContactList } from "./ContactList";
import { getPipelineStages, getStageLabel } from "./pipelines";
import { ProjectStageFlow } from "./ProjectStageFlow";

export const DealShow = ({ id }: { id?: string }) => {
  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-4">
      {id ? (
        <ShowBase id={id}>
          <DealShowContent />
        </ShowBase>
      ) : null}
    </div>
  );
};

const DealShowContent = () => {
  const config = useConfigurationContext();
  const record = useRecordContext<Deal>();
  const notify = useNotify();
  const refresh = useRefresh();
  const [update, { isPending: isUpdatingStage }] = useUpdate();
  const [currentTab, setCurrentTab] = useState<DealTab>("summary");
  const [visitedTabs, setVisitedTabs] = useState<Set<DealTab>>(
    () => new Set(["summary"]),
  );

  const { total: hoursCount } = useGetList<TimeEntry>(
    "time_entries",
    {
      filter: { "project_id@eq": record?.id },
      pagination: { page: 1, perPage: 1 },
      sort: { field: "date", order: "DESC" },
    },
    { enabled: !!record?.id, staleTime: 30_000 },
  );
  const { data: projectTimeEntries } = useGetList<TimeEntry>(
    "time_entries",
    {
      filter: { "project_id@eq": record?.id },
      pagination: { page: 1, perPage: 500 },
      sort: { field: "date", order: "DESC" },
    },
    { enabled: !!record?.id, staleTime: 30_000 },
  );
  const personIds = useMemo(
    () =>
      Array.from(
        new Set((projectTimeEntries ?? []).map((entry) => Number(entry.person_id))),
      ),
    [projectTimeEntries],
  );
  const { data: subcontractors } = useGetList<Person>(
    "people",
    {
      filter: {
        ...(personIds.length > 0
          ? { "id@in": `(${personIds.join(",")})` }
          : { "id@in": "(-1)" }),
        "type@eq": "subcontractor",
      },
      pagination: { page: 1, perPage: 500 },
      sort: { field: "last_name", order: "ASC" },
    },
    { enabled: !!record?.id, staleTime: 30_000 },
  );
  const { data: commissionLines, total: commissionsCount } = useGetList<PaymentLine>(
    "payment_lines",
    {
      filter: {
        "project_id@eq": record?.id,
        "source_type@eq": "commission",
      },
      pagination: { page: 1, perPage: 500 },
      sort: { field: "created_at", order: "DESC" },
    },
    { enabled: !!record?.id, staleTime: 30_000 },
  );
  const { data: paymentLines } = useGetList<PaymentLine>(
    "payment_lines",
    {
      filter: { "project_id@eq": record?.id },
      pagination: { page: 1, perPage: 500 },
      sort: { field: "created_at", order: "DESC" },
    },
    { enabled: !!record?.id, staleTime: 30_000 },
  );
  const paymentIds = useMemo(
    () =>
      Array.from(
        new Set((paymentLines ?? []).map((line) => Number(line.payment_id)).filter(Boolean)),
      ),
    [paymentLines],
  );
  const { total: notesCount, data: dealNotes } = useGetList<DealNote>(
    "deal_notes",
    {
      filter: { "deal_id@eq": record?.id },
      pagination: { page: 1, perPage: 200 },
      sort: { field: "date", order: "DESC" },
    },
    { enabled: !!record?.id, staleTime: 30_000 },
  );

  const attachments = useMemo(
    () =>
      (dealNotes ?? []).flatMap((note) => note.attachments ?? []).filter((file) => !!file.src),
    [dealNotes],
  );
  const photosCount = useMemo(
    () =>
      attachments.filter((file) => {
        const lower = file.src.toLowerCase();
        return (
          file.type?.startsWith("image/") ||
          lower.endsWith(".png") ||
          lower.endsWith(".jpg") ||
          lower.endsWith(".jpeg") ||
          lower.endsWith(".webp")
        );
      }).length,
    [attachments],
  );
  const documentsCount = attachments.length - photosCount;

  const paymentsCount = paymentIds.length;
  const subcontractorsCount = subcontractors?.length ?? 0;
  const pipelineStages = useMemo(
    () => getPipelineStages(config, record?.pipeline_id),
    [config, record?.pipeline_id],
  );

  if (!record) return null;

  const handleStageChange = (stageId: string) => {
    if (isUpdatingStage || stageId === record.stage) return;

    update(
      "deals",
      {
        id: record.id,
        data: { stage: stageId },
        previousData: record,
      },
      {
        onSuccess: () => {
          notify("Project stage updated", { type: "info", undoable: false });
          refresh();
        },
        onError: () => {
          notify("Error: stage was not updated", { type: "error" });
        },
      },
    );
  };

  const onTabChange = (value: string) => {
    const tab = getDealTab(value);
    setCurrentTab(tab);
    setVisitedTabs((prev) => {
      if (prev.has(tab)) return prev;
      const next = new Set(prev);
      next.add(tab);
      return next;
    });
  };

  return (
    <div className="space-y-2">
      {record.archived_at ? <ArchivedTitle /> : null}
      <div className="flex-1">
        <div className="mb-4">
          <Button asChild variant="ghost" size="sm" className="gap-2">
            <Link to="/deals">
              <ArrowLeft className="h-4 w-4" />
              Back to projects
            </Link>
          </Button>
        </div>
        <div className="flex justify-between items-start mb-8">
          <div className="flex items-center gap-4">
            <ReferenceField source="company_id" reference="companies" link="show">
              <CompanyAvatar />
            </ReferenceField>
            <h2 className="text-2xl font-semibold">{record.name}</h2>
          </div>
          <div className={`flex gap-2 ${record.archived_at ? "" : "pr-12"}`}>
            {record.archived_at ? (
              <>
                <UnarchiveButton record={record} />
                <DeleteButton />
              </>
            ) : (
              <>
                <ArchiveButton record={record} />
                <EditButton />
              </>
            )}
          </div>
        </div>
        <ProjectStageFlow
          stages={pipelineStages}
          currentStage={record.stage}
          onStageChange={handleStageChange}
        />

        <Tabs value={currentTab} onValueChange={onTabChange} className="w-full">
          <div className="overflow-x-auto">
            <TabsList className="inline-flex h-10 w-max min-w-full items-center justify-start gap-1">
              <DealTabTrigger value="summary" label="Summary" />
              <DealTabTrigger
                value="hours"
                label="Hours"
                count={typeof hoursCount === "number" ? hoursCount : undefined}
              />
              <DealTabTrigger
                value="subcontractors"
                label="Subcontractors"
                count={subcontractorsCount}
              />
              <DealTabTrigger value="expenses" label="Expenses" count={0} />
              <DealTabTrigger value="change-orders" label="Change Orders" count={0} />
              <DealTabTrigger
                value="commissions"
                label="Commissions"
                count={typeof commissionsCount === "number" ? commissionsCount : undefined}
              />
              <DealTabTrigger value="payments" label="Payments" count={paymentsCount} />
              <DealTabTrigger value="documents" label="Documents" count={documentsCount} />
              <DealTabTrigger value="photos" label="Photos" count={photosCount} />
              <DealTabTrigger
                value="notes"
                label="Notes"
                count={typeof notesCount === "number" ? notesCount : undefined}
              />
            </TabsList>
          </div>

          <TabsContent value="summary" className="pt-4">
            {visitedTabs.has("summary") ? <DealSummaryTab record={record} /> : null}
          </TabsContent>
          <TabsContent value="hours" className="pt-4">
            {visitedTabs.has("hours") ? <DealHoursTab dealId={record.id} /> : null}
          </TabsContent>
          <TabsContent value="subcontractors" className="pt-4">
            {visitedTabs.has("subcontractors") ? (
              <DealSubcontractorsTab dealId={record.id} />
            ) : null}
          </TabsContent>
          <TabsContent value="expenses" className="pt-4">
            {visitedTabs.has("expenses") ? (
              <EmptyDealTab label="No expenses linked to this project yet." />
            ) : null}
          </TabsContent>
          <TabsContent value="change-orders" className="pt-4">
            {visitedTabs.has("change-orders") ? (
              <EmptyDealTab label="No change orders linked to this project yet." />
            ) : null}
          </TabsContent>
          <TabsContent value="commissions" className="pt-4">
            {visitedTabs.has("commissions") ? (
              <DealCommissionsTab lines={commissionLines ?? []} />
            ) : null}
          </TabsContent>
          <TabsContent value="payments" className="pt-4">
            {visitedTabs.has("payments") ? (
              <DealPaymentsTab dealId={record.id} paymentLines={paymentLines ?? []} />
            ) : null}
          </TabsContent>
          <TabsContent value="documents" className="pt-4">
            {visitedTabs.has("documents") ? (
              <DealFilesTab
                files={attachments.filter((file) => {
                  const lower = file.src.toLowerCase();
                  return !(
                    file.type?.startsWith("image/") ||
                    lower.endsWith(".png") ||
                    lower.endsWith(".jpg") ||
                    lower.endsWith(".jpeg") ||
                    lower.endsWith(".webp")
                  );
                })}
                emptyLabel="No documents uploaded for this project yet."
              />
            ) : null}
          </TabsContent>
          <TabsContent value="photos" className="pt-4">
            {visitedTabs.has("photos") ? (
              <DealFilesTab
                files={attachments.filter((file) => {
                  const lower = file.src.toLowerCase();
                  return (
                    file.type?.startsWith("image/") ||
                    lower.endsWith(".png") ||
                    lower.endsWith(".jpg") ||
                    lower.endsWith(".jpeg") ||
                    lower.endsWith(".webp")
                  );
                })}
                emptyLabel="No photos uploaded for this project yet."
              />
            ) : null}
          </TabsContent>
          <TabsContent value="notes" className="pt-4">
            {visitedTabs.has("notes") ? <DealNotesTab /> : null}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

const DEAL_TABS = [
  "summary",
  "hours",
  "subcontractors",
  "expenses",
  "change-orders",
  "commissions",
  "payments",
  "documents",
  "photos",
  "notes",
] as const;
type DealTab = (typeof DEAL_TABS)[number];

const getDealTab = (value: string): DealTab =>
  DEAL_TABS.includes(value as DealTab) ? (value as DealTab) : "summary";

const DealTabTrigger = ({
  value,
  label,
  count,
}: {
  value: DealTab;
  label: string;
  count?: number;
}) => (
  <TabsTrigger value={value} className="gap-2">
    {label}
    {typeof count === "number" ? (
      <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] leading-none">
        {count}
      </span>
    ) : null}
  </TabsTrigger>
);

const DealSummaryTab = ({ record }: { record: Deal }) => {
  const { dealCategories, dealPipelines } = useConfigurationContext();

  return (
    <>
      <div className="flex gap-8 m-4">
        <div className="flex flex-col mr-10">
          <span className="text-xs text-muted-foreground tracking-wide">
            Expected closing date
          </span>
          <div className="flex items-center gap-2">
            <span className="text-sm">
              {isValid(new Date(record.expected_closing_date))
                ? format(new Date(record.expected_closing_date), "PP")
                : "Invalid date"}
            </span>
            {new Date(record.expected_closing_date) < new Date() ? (
              <Badge variant="destructive">Past</Badge>
            ) : null}
          </div>
        </div>

        <div className="flex flex-col mr-10">
          <span className="text-xs text-muted-foreground tracking-wide">
            Budget
          </span>
          <span className="text-sm">
            {record.amount.toLocaleString("en-US", {
              notation: "compact",
              style: "currency",
              currency: "USD",
              currencyDisplay: "narrowSymbol",
              minimumSignificantDigits: 3,
            })}
          </span>
        </div>

        {record.category && (
          <div className="flex flex-col mr-10">
            <span className="text-xs text-muted-foreground tracking-wide">
              Category
            </span>
            <span className="text-sm">
              {dealCategories.find((c) => c.value === record.category)?.label ??
                record.category}
            </span>
          </div>
        )}

        <div className="flex flex-col mr-10">
          <span className="text-xs text-muted-foreground tracking-wide">Stage</span>
          <span className="text-sm">
            {getStageLabel(
              { dealPipelines },
              record.stage,
              record.pipeline_id,
            )}
          </span>
        </div>
      </div>

      {!!record.contact_ids?.length && (
        <div className="m-4">
          <div className="flex flex-col min-h-12 mr-10">
            <span className="text-xs text-muted-foreground tracking-wide">Contacts</span>
            <ReferenceArrayField source="contact_ids" reference="contacts_summary">
              <ContactList />
            </ReferenceArrayField>
          </div>
        </div>
      )}

      {record.description && (
        <div className="m-4 whitespace-pre-line">
          <span className="text-xs text-muted-foreground tracking-wide">Description</span>
          <p className="text-sm leading-6">{record.description}</p>
        </div>
      )}
    </>
  );
};

const DealHoursTab = ({ dealId }: { dealId: Deal["id"] }) => {
  const { data: entries, isPending } = useGetList<TimeEntry>(
    "time_entries",
    {
      filter: { "project_id@eq": dealId },
      pagination: { page: 1, perPage: 200 },
      sort: { field: "date", order: "DESC" },
    },
    { staleTime: 30_000 },
  );
  const personIds = useMemo(
    () => Array.from(new Set((entries ?? []).map((entry) => entry.person_id))),
    [entries],
  );
  const { data: people } = useGetMany<Person>(
    "people",
    { ids: personIds },
    { enabled: personIds.length > 0 },
  );
  const peopleById = useMemo(
    () => Object.fromEntries((people ?? []).map((person) => [person.id, person])),
    [people],
  );
  const totalHours = useMemo(
    () => (entries ?? []).reduce((sum, entry) => sum + Number(entry.hours ?? 0), 0),
    [entries],
  );

  if (isPending) return <EmptyDealTab label="Loading hours..." />;
  if (!entries?.length) return <EmptyDealTab label="No hours linked to this project yet." />;

  return (
    <div className="space-y-3">
      <div className="text-sm text-muted-foreground">
        Total logged: <strong className="text-foreground">{totalHours.toFixed(2)}h</strong>
      </div>
      <div className="overflow-x-auto rounded-md border">
        <table className="min-w-full text-sm">
          <thead className="bg-muted/40">
            <tr>
              <th className="px-3 py-2 text-left font-medium">Date</th>
              <th className="px-3 py-2 text-left font-medium">Person</th>
              <th className="px-3 py-2 text-left font-medium">Hours</th>
              <th className="px-3 py-2 text-left font-medium">Status</th>
            </tr>
          </thead>
          <tbody>
            {entries.map((entry) => (
              <tr key={entry.id} className="border-t">
                <td className="px-3 py-2">
                  {new Date(entry.date).toLocaleDateString()}
                </td>
                <td className="px-3 py-2">
                  {peopleById[entry.person_id]
                    ? `${peopleById[entry.person_id].first_name} ${peopleById[entry.person_id].last_name}`
                    : "—"}
                </td>
                <td className="px-3 py-2">{Number(entry.hours ?? 0).toFixed(2)}</td>
                <td className="px-3 py-2">{entry.status}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

const DealSubcontractorsTab = ({ dealId }: { dealId: Deal["id"] }) => {
  const { data: entries, isPending } = useGetList<TimeEntry>(
    "time_entries",
    {
      filter: { "project_id@eq": dealId },
      pagination: { page: 1, perPage: 500 },
      sort: { field: "date", order: "DESC" },
    },
    { staleTime: 30_000 },
  );
  const personIds = useMemo(
    () =>
      Array.from(new Set((entries ?? []).map((entry) => Number(entry.person_id)).filter(Boolean))),
    [entries],
  );
  const { data: people } = useGetList<Person>(
    "people",
    {
      filter: {
        ...(personIds.length > 0
          ? { "id@in": `(${personIds.join(",")})` }
          : { "id@in": "(-1)" }),
        "type@eq": "subcontractor",
      },
      pagination: { page: 1, perPage: 500 },
      sort: { field: "last_name", order: "ASC" },
    },
    { enabled: personIds.length > 0, staleTime: 30_000 },
  );
  const rows = useMemo(() => {
    const subcontractorIds = new Set((people ?? []).map((person) => Number(person.id)));
    const totals = new Map<number, number>();
    (entries ?? []).forEach((entry) => {
      const personId = Number(entry.person_id);
      if (!subcontractorIds.has(personId)) return;
      totals.set(personId, (totals.get(personId) ?? 0) + Number(entry.hours ?? 0));
    });
    return (people ?? []).map((person) => ({
      person,
      hours: totals.get(Number(person.id)) ?? 0,
    }));
  }, [entries, people]);

  if (isPending) return <EmptyDealTab label="Loading subcontractors..." />;
  if (!rows.length) return <EmptyDealTab label="No subcontractors linked yet." />;

  return (
    <div className="overflow-x-auto rounded-md border">
      <table className="min-w-full text-sm">
        <thead className="bg-muted/40">
          <tr>
            <th className="px-3 py-2 text-left font-medium">Name</th>
            <th className="px-3 py-2 text-left font-medium">Email</th>
            <th className="px-3 py-2 text-left font-medium">Hours</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(({ person, hours }) => (
            <tr key={person.id} className="border-t">
              <td className="px-3 py-2">{person.first_name} {person.last_name}</td>
              <td className="px-3 py-2">{person.email || "—"}</td>
              <td className="px-3 py-2">{hours.toFixed(2)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

const DealCommissionsTab = ({ lines }: { lines: PaymentLine[] }) => {
  const total = useMemo(
    () => lines.reduce((sum, line) => sum + Number(line.amount ?? 0), 0),
    [lines],
  );

  if (!lines.length) return <EmptyDealTab label="No commissions tied to this project yet." />;

  return (
    <div className="space-y-3">
      <div className="text-sm text-muted-foreground">
        Total commissions:{" "}
        <strong className="text-foreground">
          {total.toLocaleString("en-US", {
            style: "currency",
            currency: "USD",
          })}
        </strong>
      </div>
      <div className="overflow-x-auto rounded-md border">
        <table className="min-w-full text-sm">
          <thead className="bg-muted/40">
            <tr>
              <th className="px-3 py-2 text-left font-medium">Created</th>
              <th className="px-3 py-2 text-left font-medium">Amount</th>
              <th className="px-3 py-2 text-left font-medium">Notes</th>
            </tr>
          </thead>
          <tbody>
            {lines.map((line) => (
              <tr key={line.id} className="border-t">
                <td className="px-3 py-2">
                  {line.created_at
                    ? new Date(line.created_at).toLocaleDateString()
                    : "—"}
                </td>
                <td className="px-3 py-2">
                  {Number(line.amount ?? 0).toLocaleString("en-US", {
                    style: "currency",
                    currency: "USD",
                  })}
                </td>
                <td className="px-3 py-2">{line.notes ?? "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

const DealPaymentsTab = ({
  dealId,
  paymentLines,
}: {
  dealId: Deal["id"];
  paymentLines: PaymentLine[];
}) => {
  const paymentIds = useMemo(
    () =>
      Array.from(
        new Set(paymentLines.map((line) => Number(line.payment_id)).filter(Boolean)),
      ),
    [paymentLines],
  );
  const { data: payments } = useGetMany<Payment>(
    "payments",
    { ids: paymentIds },
    { enabled: paymentIds.length > 0 },
  );
  const paymentById = useMemo(
    () => Object.fromEntries((payments ?? []).map((payment) => [Number(payment.id), payment])),
    [payments],
  );
  const rows = useMemo(() => {
    const grouped = new Map<number, number>();
    paymentLines.forEach((line) => {
      const paymentId = Number(line.payment_id);
      grouped.set(paymentId, (grouped.get(paymentId) ?? 0) + Number(line.amount ?? 0));
    });
    return Array.from(grouped.entries())
      .map(([paymentId, amount]) => ({
        paymentId,
        amount,
        payment: paymentById[paymentId],
      }))
      .sort(
        (left, right) =>
          new Date(right.payment?.pay_date ?? 0).getTime() -
          new Date(left.payment?.pay_date ?? 0).getTime(),
      );
  }, [paymentById, paymentLines]);

  if (!paymentLines.length) return <EmptyDealTab label="No payments tied to this project yet." />;

  return (
    <div className="overflow-x-auto rounded-md border">
      <table className="min-w-full text-sm">
        <thead className="bg-muted/40">
          <tr>
            <th className="px-3 py-2 text-left font-medium">Pay Date</th>
            <th className="px-3 py-2 text-left font-medium">Amount</th>
            <th className="px-3 py-2 text-left font-medium">Status</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={`${dealId}-${row.paymentId}`} className="border-t">
              <td className="px-3 py-2">
                {row.payment ? (
                  <Link className="underline" to={`/payments/${row.paymentId}/show`}>
                    {new Date(row.payment.pay_date).toLocaleDateString()}
                  </Link>
                ) : (
                  "—"
                )}
              </td>
              <td className="px-3 py-2">
                {row.amount.toLocaleString("en-US", {
                  style: "currency",
                  currency: "USD",
                })}
              </td>
              <td className="px-3 py-2">{row.payment?.status ?? "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

const DealFilesTab = ({
  files,
  emptyLabel,
}: {
  files: Array<{ src: string; title: string }>;
  emptyLabel: string;
}) => {
  if (!files.length) return <EmptyDealTab label={emptyLabel} />;
  return (
    <div className="grid grid-cols-1 gap-2">
      {files.map((file, index) => (
        <a
          key={`${file.src}-${index}`}
          href={file.src}
          target="_blank"
          rel="noreferrer"
          className="rounded-md border px-3 py-2 text-sm underline"
        >
          {file.title || `File ${index + 1}`}
        </a>
      ))}
    </div>
  );
};

const DealNotesTab = () => (
  <div className="m-2">
    <Separator className="mb-4" />
    <ReferenceManyField
      target="deal_id"
      reference="deal_notes"
      sort={{ field: "date", order: "DESC" }}
      empty={<NoteCreate reference={"deals"} />}
    >
      <NotesIterator reference="deals" />
    </ReferenceManyField>
  </div>
);

const EmptyDealTab = ({ label }: { label: string }) => (
  <div className="rounded-md border border-dashed p-6 text-sm text-muted-foreground">
    {label}
  </div>
);

const ArchivedTitle = () => (
  <div className="bg-orange-500 px-6 py-4">
    <h3 className="text-lg font-bold text-white">Archived Project</h3>
  </div>
);

const ArchiveButton = ({ record }: { record: Deal }) => {
  const [update] = useUpdate();
  const redirect = useRedirect();
  const notify = useNotify();
  const refresh = useRefresh();
  const handleClick = () => {
    update(
      "deals",
      {
        id: record.id,
        data: { archived_at: new Date().toISOString() },
        previousData: record,
      },
      {
        onSuccess: () => {
          redirect("list", "deals");
          notify("Project archived", { type: "info", undoable: false });
          refresh();
        },
        onError: () => {
          notify("Error: project not archived", { type: "error" });
        },
      },
    );
  };

  return (
    <Button
      onClick={handleClick}
      size="sm"
      variant="outline"
      className="flex items-center gap-2 h-9"
    >
      <Archive className="w-4 h-4" />
      Archive
    </Button>
  );
};

const UnarchiveButton = ({ record }: { record: Deal }) => {
  const dataProvider = useDataProvider();
  const redirect = useRedirect();
  const notify = useNotify();
  const refresh = useRefresh();

  const { mutate } = useMutation({
    mutationFn: () => dataProvider.unarchiveDeal(record),
    onSuccess: () => {
      redirect("list", "deals");
      notify("Project unarchived", {
        type: "info",
        undoable: false,
      });
      refresh();
    },
    onError: () => {
      notify("Error: project not unarchived", { type: "error" });
    },
  });

  const handleClick = () => {
    mutate();
  };

  return (
    <Button
      onClick={handleClick}
      size="sm"
      variant="outline"
      className="flex items-center gap-2 h-9"
    >
      <ArchiveRestore className="w-4 h-4" />
      Send back to the board
    </Button>
  );
};
