import { useMutation } from "@tanstack/react-query";
import { format, isValid } from "date-fns";
import {
  Archive,
  ArchiveRestore,
  ArrowLeft,
  Check,
  ChevronDown,
  ChevronUp,
  Download,
  Eye,
  FileArchive,
  FileAudio,
  FileCode,
  FileSpreadsheet,
  FileText,
  FileVideo,
  Link2,
  Pencil,
  Trash2,
  UploadCloud,
  X,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import {
  ShowBase,
  useDataProvider,
  useCreate,
  useDelete,
  useGetIdentity,
  useGetOne,
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
import { ReferenceField } from "@/components/admin/reference-field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Link } from "react-router";
import { cn } from "@/lib/utils";
import { StickyTabsBar } from "@/components/atomic-crm/layout/page-shell";
import { canUseCrmPermission } from "../providers/commons/crmPermissions";

import { CompanyAvatar } from "../companies/CompanyAvatar";
import { NoteCreate } from "../notes/NoteCreate";
import { Note } from "../notes/Note";
import {
  extractAssetLinksFromDealNotes,
  serializeAssetLink,
  type ParsedAssetLink,
} from "../misc/assetLinks";
import { useConfigurationContext } from "../root/ConfigurationContext";
import { useNavigationLayoutPreference } from "../layout/navigationLayoutPreference";
import type {
  Contact,
  Deal,
  DealChangeOrder,
  DealClientPayment,
  DealCommission,
  DealExpense,
  DealSubcontractorEntry,
  DealNote,
  Person,
  RAFile,
  TimeEntry,
} from "../types";
import { DealsExplorerPanel } from "./DealsExplorerPanel";
import { getPipelineStages, getStageColor, getStageLabel } from "./pipelines";
import { ProjectStageFlow } from "./ProjectStageFlow";
import { calculateHours, splitRegularOvertimeHours } from "@/timeEntries/helpers";

export const DealShow = ({ id }: { id?: string }) => {
  const [layoutMode] = useNavigationLayoutPreference();
  const showExplorerPanel = layoutMode === "top" && !!id;

  return (
    <div className={cn("w-full py-2", layoutMode === "sidebar" ? "px-4 py-4" : "")}>
      <div className={cn(showExplorerPanel ? "flex gap-4" : "")}>
        {showExplorerPanel ? <DealsExplorerPanel currentDealId={id} /> : null}
        <div className="min-w-0 flex-1">
          {id ? (
            <ShowBase id={id}>
              <DealShowContent />
            </ShowBase>
          ) : null}
        </div>
      </div>
    </div>
  );
};

const DealShowContent = () => {
  const config = useConfigurationContext();
  const record = useRecordContext<Deal>();
  const { data: identity } = useGetIdentity();
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
  const { total: subcontractorsCount } = useGetList<DealSubcontractorEntry>(
    "deal_subcontractor_entries",
    {
      filter: { "deal_id@eq": record?.id },
      pagination: { page: 1, perPage: 1 },
      sort: { field: "created_at", order: "DESC" },
    },
    { enabled: !!record?.id, staleTime: 30_000 },
  );
  const { total: expensesCount } = useGetList<DealExpense>(
    "deal_expenses",
    {
      filter: { "deal_id@eq": record?.id },
      pagination: { page: 1, perPage: 1 },
      sort: { field: "created_at", order: "DESC" },
    },
    { enabled: !!record?.id, staleTime: 30_000 },
  );
  const { total: changeOrdersCount } = useGetList<DealChangeOrder>(
    "deal_change_orders",
    {
      filter: { "deal_id@eq": record?.id },
      pagination: { page: 1, perPage: 1 },
      sort: { field: "created_at", order: "DESC" },
    },
    { enabled: !!record?.id, staleTime: 30_000 },
  );
  const { total: commissionsCount } = useGetList<DealCommission>(
    "deal_commissions",
    {
      filter: { "deal_id@eq": record?.id },
      pagination: { page: 1, perPage: 1 },
      sort: { field: "created_at", order: "DESC" },
    },
    { enabled: !!record?.id, staleTime: 30_000 },
  );
  const { total: paymentsCount } = useGetList<DealClientPayment>(
    "deal_client_payments",
    {
      filter: { "deal_id@eq": record?.id },
      pagination: { page: 1, perPage: 1 },
      sort: { field: "payment_date", order: "DESC" },
    },
    { enabled: !!record?.id, staleTime: 30_000 },
  );
  const { data: dealNotes } = useGetList<DealNote>(
    "deal_notes",
    {
      filter: { "deal_id@eq": record?.id },
      pagination: { page: 1, perPage: 200 },
      sort: { field: "date", order: "DESC" },
    },
    { enabled: !!record?.id, staleTime: 30_000 },
  );
  const { data: subcontractorEntries } = useGetList<DealSubcontractorEntry>(
    "deal_subcontractor_entries",
    {
      filter: { "deal_id@eq": record?.id },
      pagination: { page: 1, perPage: 500 },
      sort: { field: "created_at", order: "DESC" },
    },
    { enabled: !!record?.id, staleTime: 30_000 },
  );
  const { data: expenseEntries } = useGetList<DealExpense>(
    "deal_expenses",
    {
      filter: { "deal_id@eq": record?.id },
      pagination: { page: 1, perPage: 500 },
      sort: { field: "created_at", order: "DESC" },
    },
    { enabled: !!record?.id, staleTime: 30_000 },
  );
  const { data: changeOrderEntries } = useGetList<DealChangeOrder>(
    "deal_change_orders",
    {
      filter: { "deal_id@eq": record?.id },
      pagination: { page: 1, perPage: 500 },
      sort: { field: "created_at", order: "DESC" },
    },
    { enabled: !!record?.id, staleTime: 30_000 },
  );
  const { data: clientPaymentEntries } = useGetList<DealClientPayment>(
    "deal_client_payments",
    {
      filter: { "deal_id@eq": record?.id },
      pagination: { page: 1, perPage: 500 },
      sort: { field: "payment_date", order: "DESC" },
    },
    { enabled: !!record?.id, staleTime: 30_000 },
  );

  const attachmentEntries = useMemo<DealAttachmentEntry[]>(
    () =>
      (dealNotes ?? []).flatMap((note) =>
        (note.attachments ?? [])
          .filter((file) => !!file.src)
          .map((file, index) => ({
            noteId: note.id,
            attachmentIndex: index,
            noteAttachments: note.attachments ?? [],
            file: {
              src: file.src,
              title: file.title,
              type: file.type,
              path: file.path,
            },
          })),
      ),
    [dealNotes],
  );
  const externalLinks = useMemo(
    () => extractAssetLinksFromDealNotes(dealNotes ?? []),
    [dealNotes],
  );
  const documentLinks = useMemo(
    () => externalLinks.filter((link) => link.kind === "documents"),
    [externalLinks],
  );
  const photoLinks = useMemo(
    () => externalLinks.filter((link) => link.kind === "photos"),
    [externalLinks],
  );
  const documentAttachments = useMemo(
    () =>
      attachmentEntries.filter((entry) => {
        const lower = entry.file.src.toLowerCase();
        return !(
          entry.file.type?.startsWith("image/") ||
          lower.endsWith(".png") ||
          lower.endsWith(".jpg") ||
          lower.endsWith(".jpeg") ||
          lower.endsWith(".webp")
        );
      }),
    [attachmentEntries],
  );
  const photosCount = useMemo(
    () => photoLinks.length,
    [photoLinks.length],
  );
  const documentsCount = documentAttachments.length + documentLinks.length;
  const subcontractorDocCount = useMemo(
    () =>
      (subcontractorEntries ?? []).reduce(
        (sum, entry) => sum + (entry.invoice_attachments?.length ?? 0),
        0,
      ),
    [subcontractorEntries],
  );
  const expenseDocCount = useMemo(
    () =>
      (expenseEntries ?? []).reduce(
        (sum, entry) => sum + (entry.attachments?.length ?? 0),
        0,
      ),
    [expenseEntries],
  );
  const changeOrderDocCount = useMemo(
    () =>
      (changeOrderEntries ?? []).reduce(
        (sum, entry) => sum + (entry.attachments?.length ?? 0),
        0,
      ),
    [changeOrderEntries],
  );
  const paymentDocCount = useMemo(
    () =>
      (clientPaymentEntries ?? []).reduce(
        (sum, entry) => sum + (entry.attachments?.length ?? 0),
        0,
      ),
    [clientPaymentEntries],
  );
  const allDocumentsCount =
    documentsCount +
    subcontractorDocCount +
    expenseDocCount +
    changeOrderDocCount +
    paymentDocCount;
  const subcontractorPaidCount = useMemo(
    () => (subcontractorEntries ?? []).filter((entry) => entry.status === "paid").length,
    [subcontractorEntries],
  );
  const subcontractorPendingCount = useMemo(
    () =>
      (subcontractorEntries ?? []).filter(
        (entry) => entry.status !== "paid" && entry.status !== "completed",
      ).length,
    [subcontractorEntries],
  );
  const expensesPaidCount = useMemo(
    () => (expenseEntries ?? []).filter((entry) => entry.paid).length,
    [expenseEntries],
  );
  const expensesPendingCount = useMemo(
    () => (expenseEntries ?? []).filter((entry) => !entry.paid).length,
    [expenseEntries],
  );
  const changeOrdersApprovedCount = useMemo(
    () => (changeOrderEntries ?? []).filter((entry) => entry.status === "approved").length,
    [changeOrderEntries],
  );
  const changeOrdersPendingCount = useMemo(
    () =>
      (changeOrderEntries ?? []).filter(
        (entry) => entry.status === "draft" || entry.status === "sent",
      ).length,
    [changeOrderEntries],
  );
  const { data: commissionEntries } = useGetList<DealCommission>(
    "deal_commissions",
    {
      filter: { "deal_id@eq": record?.id },
      pagination: { page: 1, perPage: 500 },
      sort: { field: "created_at", order: "DESC" },
    },
    { enabled: !!record?.id, staleTime: 30_000 },
  );
  const commissionsPaid = useMemo(
    () => (commissionEntries ?? []).filter((entry) => entry.paid).length,
    [commissionEntries],
  );
  const commissionsPending = useMemo(
    () => (commissionEntries ?? []).filter((entry) => !entry.paid).length,
    [commissionEntries],
  );
  const paymentsClearedCount = useMemo(
    () =>
      (clientPaymentEntries ?? []).filter(
        (entry) => entry.status === "cleared" || entry.status === "deposited",
      ).length,
    [clientPaymentEntries],
  );
  const paymentsPendingCount = useMemo(
    () => (clientPaymentEntries ?? []).filter((entry) => entry.status === "pending").length,
    [clientPaymentEntries],
  );
  const notesOnlyCount = useMemo(
    () =>
      (dealNotes ?? []).filter((note) => {
        if (extractAssetLinksFromDealNotes([note]).length > 0) return false;
        if (!note.text?.trim() && (note.attachments?.length ?? 0) > 0) return false;
        return true;
      }).length,
    [dealNotes],
  );

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
        meta: { identity },
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
  const canManageSales = canUseCrmPermission(identity as any, "sales.manage");

  return (
    <div className="space-y-2">
      {record.archived_at ? <ArchivedTitle /> : null}
      <div className="flex-1">
        <div className="mb-3">
          <Button asChild variant="ghost" size="sm" className="gap-2">
            <Link to="/deals">
              <ArrowLeft className="h-4 w-4" />
              Back to projects
            </Link>
          </Button>
        </div>
        <div className="mb-6 flex items-start justify-between">
          <div className="flex items-center gap-4">
            <ReferenceField source="company_id" reference="companies" link="show">
              <CompanyAvatar />
            </ReferenceField>
            <div className="space-y-1">
              <h2 className="text-2xl font-semibold">{record.name}</h2>
              <DealHeaderMeta record={record} />
            </div>
          </div>
          <div className={`flex gap-2 ${record.archived_at ? "" : "pr-12"}`}>
            {record.archived_at && canManageSales ? (
              <>
                <UnarchiveButton record={record} />
                <DeleteButton />
              </>
            ) : null}
            {!record.archived_at && canManageSales ? (
              <>
                <ArchiveButton record={record} />
                <EditButton />
              </>
            ) : null}
          </div>
        </div>
        <ProjectStageFlow
          stages={pipelineStages}
          currentStage={record.stage}
          onStageChange={handleStageChange}
        />

        <Tabs value={currentTab} onValueChange={onTabChange} className="w-full">
          <StickyTabsBar className="pb-0.5">
            <div className="overflow-x-auto">
              <TabsList className="inline-flex h-10 w-max min-w-full items-center justify-start gap-1 rounded-lg border bg-muted/60 px-1 shadow-sm">
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
                  badges={[
                    { label: "paid", value: subcontractorPaidCount, tone: "emerald" },
                    { label: "pending", value: subcontractorPendingCount, tone: "amber" },
                  ]}
                />
                <DealTabTrigger
                  value="expenses"
                  label="Expenses"
                  count={typeof expensesCount === "number" ? expensesCount : undefined}
                  badges={[
                    { label: "paid", value: expensesPaidCount, tone: "emerald" },
                    { label: "pending", value: expensesPendingCount, tone: "amber" },
                  ]}
                />
                <DealTabTrigger
                  value="change-orders"
                  label="Change Orders"
                  count={typeof changeOrdersCount === "number" ? changeOrdersCount : undefined}
                  badges={[
                    { label: "approved", value: changeOrdersApprovedCount, tone: "emerald" },
                    { label: "pending", value: changeOrdersPendingCount, tone: "amber" },
                  ]}
                />
                <DealTabTrigger
                  value="commissions"
                  label="Commissions"
                  count={typeof commissionsCount === "number" ? commissionsCount : undefined}
                  badges={[
                    { label: "paid", value: commissionsPaid, tone: "emerald" },
                    { label: "pending", value: commissionsPending, tone: "amber" },
                  ]}
                />
                <DealTabTrigger
                  value="payments"
                  label="Payments"
                  count={typeof paymentsCount === "number" ? paymentsCount : undefined}
                  badges={[
                    { label: "cleared", value: paymentsClearedCount, tone: "emerald" },
                    { label: "pending", value: paymentsPendingCount, tone: "amber" },
                  ]}
                />
                <DealTabTrigger value="documents" label="Documents" count={allDocumentsCount} />
                <DealTabTrigger value="photos" label="Photos" count={photosCount} />
                <DealTabTrigger
                  value="notes"
                  label="Notes"
                  count={notesOnlyCount}
                />
              </TabsList>
            </div>
          </StickyTabsBar>

          <TabsContent value="summary" className="pt-3">
            {visitedTabs.has("summary") ? <DealSummaryTab record={record} /> : null}
          </TabsContent>
          <TabsContent value="hours" className="pt-3">
            {visitedTabs.has("hours") ? <DealHoursTab dealId={record.id} /> : null}
          </TabsContent>
          <TabsContent value="subcontractors" className="pt-3">
            {visitedTabs.has("subcontractors") ? (
              <DealSubcontractorsTab dealId={record.id} />
            ) : null}
          </TabsContent>
          <TabsContent value="expenses" className="pt-3">
            {visitedTabs.has("expenses") ? (
              <DealExpensesTab dealId={record.id} />
            ) : null}
          </TabsContent>
          <TabsContent value="change-orders" className="pt-3">
            {visitedTabs.has("change-orders") ? (
              <DealChangeOrdersTab dealId={record.id} />
            ) : null}
          </TabsContent>
          <TabsContent value="commissions" className="pt-3">
            {visitedTabs.has("commissions") ? (
              <DealCommissionsTab dealId={record.id} />
            ) : null}
          </TabsContent>
          <TabsContent value="payments" className="pt-3">
            {visitedTabs.has("payments") ? (
              <DealPaymentsTab dealId={record.id} />
            ) : null}
          </TabsContent>
          <TabsContent value="documents" className="pt-3">
            {visitedTabs.has("documents") ? (
              <DealFilesTab
                dealId={record.id}
                kind="documents"
                files={documentAttachments}
                links={documentLinks}
                groupedSources={{
                  payments: (clientPaymentEntries ?? []).flatMap((entry) => entry.attachments ?? []),
                  subcontractors: (subcontractorEntries ?? []).flatMap(
                    (entry) => entry.invoice_attachments ?? [],
                  ),
                  expenses: (expenseEntries ?? []).flatMap((entry) => entry.attachments ?? []),
                  changeOrders: (changeOrderEntries ?? []).flatMap(
                    (entry) => entry.attachments ?? [],
                  ),
                }}
                emptyLabel="No documents uploaded for this project yet."
              />
            ) : null}
          </TabsContent>
          <TabsContent value="photos" className="pt-3">
            {visitedTabs.has("photos") ? (
              <DealFilesTab
                dealId={record.id}
                kind="photos"
                files={[]}
                links={photoLinks}
                emptyLabel="No photo links for this project yet."
              />
            ) : null}
          </TabsContent>
          <TabsContent value="notes" className="pt-3">
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

type DealAttachmentEntry = {
  noteId: DealNote["id"];
  attachmentIndex: number;
  noteAttachments: Array<{
    src: string;
    title: string;
    type?: string;
    path?: string;
  }>;
  file: {
    src: string;
    title: string;
    type?: string;
    path?: string;
  };
};

type PendingUploadEntry = {
  id: string;
  file: File;
  previewUrl: string;
};

const ALLOWED_DOCUMENT_EXTENSIONS = new Set([
  "pdf",
  "doc",
  "docx",
  "xls",
  "xlsx",
  "csv",
  "txt",
]);

const isAllowedDocumentFile = (file: File) => {
  const name = file.name.toLowerCase();
  const ext = name.includes(".") ? name.split(".").pop() || "" : "";
  if (ALLOWED_DOCUMENT_EXTENSIONS.has(ext)) return true;
  if (file.type === "application/pdf") return true;
  if (
    file.type.includes("word") ||
    file.type.includes("excel") ||
    file.type.includes("spreadsheet") ||
    file.type === "text/csv" ||
    file.type === "text/plain"
  ) {
    return true;
  }
  return false;
};

const getDealTab = (value: string): DealTab =>
  DEAL_TABS.includes(value as DealTab) ? (value as DealTab) : "summary";

const DealTabTrigger = ({
  value,
  label,
  count,
  badges,
}: {
  value: DealTab;
  label: string;
  count?: number;
  badges?: Array<{ label: string; value: number; tone: "emerald" | "amber" }>;
}) => (
  <TabsTrigger
    value={value}
    className="h-8 gap-1.5 rounded-md px-3 text-[13px] font-medium text-muted-foreground transition-colors hover:text-foreground data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm"
  >
    {label}
    {typeof count === "number" ? (
      <span className="rounded-full border bg-muted px-1.5 py-0.5 text-[10px] leading-none text-muted-foreground">
        {count}
      </span>
    ) : null}
    {(badges ?? []).map((badge) =>
      badge.value > 0 ? (
        <span
          key={`${value}-${badge.label}`}
          className={cn(
            "rounded-full px-1.5 py-0.5 text-[10px] leading-none",
            badge.tone === "emerald"
              ? "bg-emerald-100/80 text-emerald-700"
              : "bg-amber-100/80 text-amber-700",
          )}
        >
          {badge.label}:{badge.value}
        </span>
      ) : null,
    )}
  </TabsTrigger>
);

const DealSummaryTab = ({ record }: { record: Deal }) => {
  const { dealPipelines } = useConfigurationContext();
  const { data: hours = [] } = useGetList<TimeEntry>(
    "time_entries",
    {
      filter: { "project_id@eq": record.id },
      pagination: { page: 1, perPage: 1000 },
      sort: { field: "date", order: "DESC" },
    },
    { staleTime: 30_000 },
  );
  const employeeIds = useMemo(
    () => Array.from(new Set(hours.map((entry) => Number(entry.person_id)).filter(Boolean))),
    [hours],
  );
  const { data: employees = [] } = useGetMany<Person>(
    "people",
    { ids: employeeIds },
    { enabled: employeeIds.length > 0, staleTime: 30_000 },
  );
  const personById = useMemo(
    () => Object.fromEntries(employees.map((person) => [Number(person.id), person])),
    [employees],
  );
  const { data: subcontractorEntries = [] } = useGetList<DealSubcontractorEntry>(
    "deal_subcontractor_entries",
    {
      filter: { "deal_id@eq": record.id },
      pagination: { page: 1, perPage: 1000 },
      sort: { field: "created_at", order: "DESC" },
    },
    { staleTime: 30_000 },
  );
  const { data: expenses = [] } = useGetList<DealExpense>(
    "deal_expenses",
    {
      filter: { "deal_id@eq": record.id },
      pagination: { page: 1, perPage: 1000 },
      sort: { field: "created_at", order: "DESC" },
    },
    { staleTime: 30_000 },
  );
  const { data: changeOrders = [] } = useGetList<DealChangeOrder>(
    "deal_change_orders",
    {
      filter: { "deal_id@eq": record.id },
      pagination: { page: 1, perPage: 1000 },
      sort: { field: "created_at", order: "DESC" },
    },
    { staleTime: 30_000 },
  );
  const { data: commissions = [] } = useGetList<DealCommission>(
    "deal_commissions",
    {
      filter: { "deal_id@eq": record.id },
      pagination: { page: 1, perPage: 1000 },
      sort: { field: "created_at", order: "DESC" },
    },
    { staleTime: 30_000 },
  );
  const { data: clientPayments = [] } = useGetList<DealClientPayment>(
    "deal_client_payments",
    {
      filter: { "deal_id@eq": record.id },
      pagination: { page: 1, perPage: 1000 },
      sort: { field: "payment_date", order: "DESC" },
    },
    { staleTime: 30_000 },
  );

  const totalCollected = useMemo(
    () =>
      clientPayments
        .filter((payment) => payment.status === "cleared" || payment.status === "deposited")
        .reduce((sum, payment) => sum + Number(payment.amount ?? 0), 0),
    [clientPayments],
  );
  const totalPendingToCollect = useMemo(
    () =>
      Math.max(
        0,
        Number(record.current_project_value ?? record.original_project_value ?? record.amount ?? 0) -
          totalCollected,
      ),
    [record.amount, record.current_project_value, record.original_project_value, totalCollected],
  );
  const totalSubcontractorCost = useMemo(
    () =>
      subcontractorEntries.reduce((sum, entry) => sum + Number(entry.cost_amount ?? 0), 0),
    [subcontractorEntries],
  );
  const totalExpenseCost = useMemo(
    () => expenses.reduce((sum, expense) => sum + Number(expense.amount ?? 0), 0),
    [expenses],
  );
  const totalApprovedChangeOrders = useMemo(
    () =>
      changeOrders
        .filter((changeOrder) => changeOrder.status === "approved")
        .reduce((sum, changeOrder) => sum + Number(changeOrder.amount ?? 0), 0),
    [changeOrders],
  );
  const totalLaborCost = useMemo(
    () =>
      hours.reduce((sum, entry) => {
        const person = personById[Number(entry.person_id)];
        const regularHours = Number(entry.regular_hours ?? entry.hours ?? 0);
        const overtimeHours = Number(entry.overtime_hours ?? 0);
        const paidDayHours = Math.max(Number(person?.paid_day_hours ?? 8), 1);
        const hourlyRate =
          Number(person?.hourly_rate ?? 0) ||
          Number(person?.day_rate ?? 0) / paidDayHours ||
          0;
        const overtimeMultiplier = Math.max(Number(person?.overtime_rate_multiplier ?? 1.5), 1);
        return sum + regularHours * hourlyRate + overtimeHours * hourlyRate * overtimeMultiplier;
      }, 0),
    [hours, personById],
  );
  const totalCommissionCost = useMemo(
    () =>
      commissions.reduce((sum, commission) => {
        const value = Number(commission.commission_value ?? 0);
        if (commission.commission_type === "fixed") return sum + value;
        if (commission.basis === "payments_collected") return sum + totalCollected * (value / 100);
        return sum;
      }, 0),
    [commissions, totalCollected],
  );
  const totalCost =
    totalLaborCost + totalSubcontractorCost + totalExpenseCost + totalCommissionCost;
  const profit = totalCollected - totalCost;
  const currentProjectValue =
    Number(record.current_project_value ?? 0) ||
    Number(record.original_project_value ?? 0) ||
    Number(record.estimated_value ?? 0) ||
    Number(record.amount ?? 0);
  const originalProjectValue =
    Number(record.original_project_value ?? 0) ||
    Number(record.estimated_value ?? 0) ||
    Number(record.amount ?? 0);
  const collectedPercent = clampPercent(
    currentProjectValue > 0 ? (totalCollected / currentProjectValue) * 100 : 0,
  );
  const costRatio = currentProjectValue > 0 ? totalCost / currentProjectValue : 0;
  const marginOnCollected = totalCollected > 0 ? profit / totalCollected : 0;
  const healthState = getProjectHealthState({
    profit,
    collectedPercent,
    costRatio,
    marginOnCollected,
  });
  const healthStyle = PROJECT_HEALTH_STYLE[healthState];
  const stageList = getPipelineStages({ dealPipelines }, record.pipeline_id);
  const currentStageIndex = Math.max(
    0,
    stageList.findIndex((stage) => stage.id === record.stage),
  );
  const totalStages = stageList.length || 1;
  const stageProgressPercent = ((currentStageIndex + 1) / totalStages) * 100;
  const costRows = [
    { label: "Labor Cost", value: totalLaborCost },
    { label: "Subcontractor Cost", value: totalSubcontractorCost },
    { label: "Expenses", value: totalExpenseCost },
    { label: "Commissions", value: totalCommissionCost },
  ];

  return (
    <div className="space-y-3 max-[430px]:space-y-2 max-[390px]:space-y-1.5 min-[391px]:max-[393px]:space-y-2 min-[412px]:max-[430px]:space-y-2.5 sm:space-y-6">
      <div className="flex flex-wrap gap-3 max-[430px]:gap-2 max-[390px]:gap-1.5 min-[391px]:max-[393px]:gap-2 min-[412px]:max-[430px]:gap-2.5 sm:gap-4">
        <div className="min-w-[210px] flex-[1_1_250px] rounded-lg border bg-card p-3 shadow-sm ring-1 ring-black/5 transition-shadow hover:shadow-md dark:ring-white/10 max-[430px]:min-h-[132px] max-[430px]:p-2 max-[390px]:min-h-[126px] max-[390px]:p-1.5 min-[391px]:max-[393px]:min-h-[130px] min-[391px]:max-[393px]:p-2 min-[412px]:max-[430px]:min-h-[136px] min-[412px]:max-[430px]:p-2.5 sm:p-4">
          <div className="text-[clamp(0.62rem,0.52rem+0.18vw,0.72rem)] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
            Total Project Value
          </div>
          <div className="mt-2 flex flex-col gap-2 max-[430px]:mt-1.5 max-[390px]:gap-1.5 min-[412px]:max-[430px]:gap-2.5 sm:mt-4 sm:gap-4 lg:flex-row lg:items-center">
            <svg viewBox="0 0 42 42" className="h-16 w-16 shrink-0 transition-all duration-500 ease-out sm:h-[6.5rem] sm:w-[6.5rem]" aria-hidden>
              <circle
                cx="21"
                cy="21"
                r="16"
                fill="none"
                stroke="currentColor"
                strokeWidth="4"
                className="text-muted/70"
              />
              <circle
                cx="21"
                cy="21"
                r="16"
                fill="none"
                stroke="#2563eb"
                strokeWidth="4"
                strokeLinecap="round"
                pathLength="100"
                strokeDasharray={`${Math.max(clampPercent(collectedPercent), 3)} 100`}
                className="origin-center -rotate-90"
                style={{ transformOrigin: "50% 50%" }}
              />
            </svg>
            <div className="space-y-0.5">
              <div className="max-w-full overflow-hidden text-ellipsis whitespace-nowrap text-[clamp(0.9rem,1.35vw,1.45rem)] font-semibold leading-tight tracking-tight sm:text-[clamp(1rem,1.45vw,1.6rem)]">
                {toCurrency(currentProjectValue)}
              </div>
              <div className="text-[clamp(0.58rem,0.5rem+0.14vw,0.83rem)] text-muted-foreground">
                Original vs Current
              </div>
            </div>
          </div>
        </div>

        <div className="min-w-[210px] flex-[1_1_250px] rounded-lg border bg-card p-3 shadow-sm ring-1 ring-black/5 transition-shadow hover:shadow-md dark:ring-white/10 max-[430px]:min-h-[132px] max-[430px]:p-2 max-[390px]:min-h-[126px] max-[390px]:p-1.5 min-[391px]:max-[393px]:min-h-[130px] min-[391px]:max-[393px]:p-2 min-[412px]:max-[430px]:min-h-[136px] min-[412px]:max-[430px]:p-2.5 sm:p-4">
          <div className="text-[clamp(0.62rem,0.52rem+0.18vw,0.72rem)] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
            Balance Pending
          </div>
          <div className="mt-2 flex items-center gap-3 max-[430px]:mt-1.5 sm:mt-3 sm:gap-4">
            <div className="relative w-[132px] shrink-0 max-[430px]:w-[110px]">
              <svg
                viewBox="0 0 120 72"
                className="h-16 w-full transition-all duration-500 ease-out sm:h-20"
                aria-hidden
              >
                <path
                  d="M 12 60 A 48 48 0 0 1 108 60"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="10"
                  strokeLinecap="round"
                  className="text-muted/70"
                />
                <path
                  d="M 12 60 A 48 48 0 0 1 108 60"
                  fill="none"
                  stroke="#334155"
                  strokeWidth="10"
                  strokeLinecap="round"
                  pathLength="100"
                  strokeDasharray={`${Math.max(clampPercent(collectedPercent), 2)} 100`}
                />
              </svg>
              <div className="absolute inset-0 flex items-center justify-center pt-3 text-[clamp(1.05rem,1.8vw,1.65rem)] font-semibold leading-none tracking-tight">
                {Math.round(collectedPercent)}%
              </div>
            </div>
            <div className="space-y-0.5">
              <div className="break-words text-[clamp(0.95rem,1.2vw,1.25rem)] font-semibold leading-tight tracking-tight">
                {toCurrency(totalPendingToCollect)}
              </div>
              <div className="text-[clamp(0.62rem,0.52rem+0.18vw,0.72rem)] text-muted-foreground">Balance Pending</div>
              <div className="text-[clamp(0.58rem,0.5rem+0.14vw,0.78rem)] text-muted-foreground/90">
                {Math.round(collectedPercent)}% Collected
              </div>
            </div>
          </div>
        </div>

        <div className="min-w-[280px] flex-[1.25_1_360px] rounded-lg border bg-card p-3 shadow-sm ring-1 ring-black/5 transition-shadow hover:shadow-md dark:ring-white/10 max-[430px]:min-h-[132px] max-[430px]:p-2 max-[390px]:min-h-[126px] max-[390px]:p-1.5 min-[391px]:max-[393px]:min-h-[130px] min-[391px]:max-[393px]:p-2 min-[412px]:max-[430px]:min-h-[136px] min-[412px]:max-[430px]:p-2.5 sm:p-4">
          <div className="text-[clamp(0.62rem,0.52rem+0.18vw,0.72rem)] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
            Project Health
          </div>
          <div className="mt-2 flex flex-col gap-2 max-[430px]:mt-1.5 sm:mt-3 sm:gap-3 lg:flex-row lg:items-stretch">
            <div className="hidden justify-center space-y-2 rounded-md border bg-muted/20 px-2 py-2 sm:flex sm:flex-col">
              <div className="h-4 w-4 rounded-full bg-red-400/80" />
              <div className="h-4 w-4 rounded-full bg-amber-400/80" />
              <div className="h-4 w-4 rounded-full bg-blue-400/80" />
              <div className="h-4 w-4 rounded-full bg-emerald-400/80" />
            </div>
            <div
              className={cn(
                "flex flex-1 items-center justify-between rounded-md border px-2.5 py-2 transition-all duration-300 ease-out max-[430px]:px-2 max-[430px]:py-1.5 max-[390px]:px-1.5 max-[390px]:py-1.5 min-[412px]:max-[430px]:px-2.5 min-[412px]:max-[430px]:py-2 sm:px-3 sm:py-2.5",
                healthStyle.containerClassName,
              )}
            >
              <div className="space-y-1">
                <div
                  className={cn(
                    "inline-flex rounded px-2 py-0.5 text-[clamp(0.56rem,0.5rem+0.12vw,0.72rem)] font-semibold uppercase tracking-wide",
                    healthStyle.badgeClassName,
                  )}
                >
                  {healthStyle.label}
                </div>
                <div
                  className={cn(
                    "break-words text-[clamp(1.08rem,1.9vw,2rem)] font-semibold tracking-tight",
                    healthStyle.amountClassName,
                  )}
                >
                  {toCurrency(profit)}
                </div>
                <div className="text-[clamp(0.58rem,0.5rem+0.14vw,0.72rem)] text-muted-foreground">
                  {healthStyle.metricLabel}
                </div>
              </div>
              <div className="hidden text-right text-[clamp(0.64rem,0.54rem+0.2vw,0.86rem)] font-medium text-muted-foreground sm:block">
                {healthStyle.message}
              </div>
            </div>
          </div>
        </div>

        <div className="min-w-[180px] flex-[0.85_1_220px] rounded-lg border bg-card p-3 shadow-sm ring-1 ring-black/5 transition-shadow hover:shadow-md dark:ring-white/10 max-[430px]:min-h-[132px] max-[430px]:p-2 max-[390px]:min-h-[126px] max-[390px]:p-1.5 min-[391px]:max-[393px]:min-h-[130px] min-[391px]:max-[393px]:p-2 min-[412px]:max-[430px]:min-h-[136px] min-[412px]:max-[430px]:p-2.5 sm:p-4">
          <div className="text-[clamp(0.62rem,0.52rem+0.18vw,0.72rem)] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
            Project Profit
          </div>
          <div
            className={cn(
              "mt-2 text-[clamp(0.95rem,1.3vw,1.55rem)] font-semibold leading-[1.15] tracking-tight",
              profit >= 0 ? "text-emerald-600" : "text-red-600",
            )}
          >
            {toCurrency(profit)}
          </div>
          <div className="mt-2 space-y-0.5">
            <div className="text-[clamp(0.62rem,0.52rem+0.18vw,0.72rem)] text-muted-foreground">Margin on collected</div>
            <div className="text-[clamp(0.72rem,0.62rem+0.2vw,0.9rem)] font-medium text-foreground/80">
              {toPercentLabel(marginOnCollected)}
            </div>
          </div>
        </div>
      </div>

      <div className="flex flex-wrap gap-3 max-[430px]:gap-2 sm:gap-4">
        <div className="min-w-[260px] flex-[1_1_320px] rounded-lg border bg-card p-3 shadow-sm ring-1 ring-black/5 transition-shadow dark:ring-white/10 max-[430px]:min-h-[196px] max-[430px]:p-2 max-[390px]:min-h-[186px] sm:p-4">
          <div className="mb-3 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
            Cost Breakdown
          </div>
          <div className="mb-2 flex justify-end text-xs text-muted-foreground">% of total value</div>
          <div className="space-y-1">
            {costRows.map((row) => (
              <div
                key={row.label}
                className="grid grid-cols-[1fr_auto_auto] items-center gap-2 border-t py-2 text-xs sm:gap-3 sm:text-sm first:border-t-0"
              >
                <div className="font-medium">{row.label}</div>
                <div>{toCurrency(row.value)}</div>
                <div className="w-14 text-right text-muted-foreground">
                  {currentProjectValue > 0
                    ? `${((row.value / currentProjectValue) * 100).toFixed(2)}%`
                    : "0.00%"}
                </div>
                <div className="col-span-3 h-1.5 rounded-full bg-muted/50">
                  <div
                    className="h-1.5 rounded-full bg-slate-500/70"
                    style={{
                      width: `${clampPercent(
                        currentProjectValue > 0
                          ? (row.value / currentProjectValue) * 100
                          : 0,
                      )}%`,
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="min-w-[260px] flex-[1_1_320px] rounded-lg border bg-card p-3 shadow-sm ring-1 ring-black/5 transition-shadow dark:ring-white/10 max-[430px]:min-h-[196px] max-[430px]:p-2 max-[390px]:min-h-[186px] sm:p-4">
          <div className="mb-3 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
            Financials Overview
          </div>
          <div className="space-y-1 text-xs sm:text-sm">
            <OverviewRow label="Values" value={toCurrency(currentProjectValue)} />
            <OverviewRow label="Payments" value={toCurrency(totalCollected)} />
            <OverviewRow label="Approved change orders" value={toCurrency(totalApprovedChangeOrders)} />
            <OverviewRow label="Total costs" value={toCurrency(totalCost)} />
            <OverviewRow
              label="Profit"
              value={toCurrency(profit)}
              valueClassName={profit >= 0 ? "text-emerald-600" : "text-red-600"}
            />
          </div>
        </div>

        <div className="min-w-[260px] flex-[1_1_320px] rounded-lg border bg-card p-3 shadow-sm ring-1 ring-black/5 transition-shadow dark:ring-white/10 max-[430px]:min-h-[196px] max-[430px]:p-2 max-[390px]:min-h-[186px] sm:p-4">
          <div className="mb-3 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
            Project Milestones
          </div>
          <div className="space-y-2 text-xs sm:text-sm">
            <OverviewRow label="Start Date" value={toDateLabel(record.start_date)} />
            <OverviewRow
              label="Expected End Date"
              value={toDateLabel(record.expected_end_date || record.expected_closing_date)}
            />
            <OverviewRow
              label="Estimated Completion"
              value={record.estimated_completion_time || "—"}
            />
            <OverviewRow
              label="Current Stage"
              value={getStageLabel({ dealPipelines }, record.stage, record.pipeline_id)}
            />
            <div className="mt-2 h-3 rounded-full bg-muted">
              <div
                className="h-3 rounded-full bg-blue-600"
                style={{ width: `${clampPercent(stageProgressPercent)}%` }}
              />
            </div>
          </div>
        </div>
      </div>

      {(record.notes || record.description) && (
        <div className="rounded-lg border bg-card p-3 shadow-sm ring-1 ring-black/5 whitespace-pre-line transition-shadow dark:ring-white/10 max-[430px]:p-2 sm:p-4">
          <div className="mb-2 text-xs uppercase tracking-wide text-muted-foreground">
            General notes
          </div>
          <p className="text-xs leading-5 sm:text-sm sm:leading-6">
            {record.notes || record.description}
          </p>
        </div>
      )}
    </div>
  );
};

const DealHoursTab = ({ dealId }: { dealId: Deal["id"] }) => {
  const [create, { isPending: isCreating }] = useCreate();
  const [update, { isPending: isUpdating }] = useUpdate();
  const notify = useNotify();
  const refresh = useRefresh();
  const [form, setForm] = useState({
    person_id: "",
    date: "",
    start_time: "",
    end_time: "",
    lunch_minutes: "30",
    status: "submitted",
    work_location: "",
    notes: "",
  });
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editErrors, setEditErrors] = useState<Record<string, string>>({});
  const [editRow, setEditRow] = useState<{
    date: string;
    start_time: string;
    end_time: string;
    lunch_minutes: string;
    status: string;
    work_location: string;
    notes: string;
  } | null>(null);

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
  const { data: employeeOptions } = useGetList<Person>(
    "people",
    {
      filter: { "type@eq": "employee", "status@eq": "active" },
      pagination: { page: 1, perPage: 500 },
      sort: { field: "last_name", order: "ASC" },
    },
    { staleTime: 30_000 },
  );
  const peopleById = useMemo(
    () => Object.fromEntries((people ?? []).map((person) => [person.id, person])),
    [people],
  );
  const totalHours = useMemo(
    () => (entries ?? []).reduce((sum, entry) => sum + Number(entry.hours ?? 0), 0),
    [entries],
  );
  const totalRegularHours = useMemo(
    () =>
      (entries ?? []).reduce((sum, entry) => sum + Number(entry.regular_hours ?? 0), 0),
    [entries],
  );
  const totalOvertimeHours = useMemo(
    () =>
      (entries ?? []).reduce((sum, entry) => sum + Number(entry.overtime_hours ?? 0), 0),
    [entries],
  );
  const totalLaborCost = useMemo(
    () =>
      (entries ?? []).reduce((sum, entry) => {
        const person = peopleById[entry.person_id];
        const regularHours = Number(entry.regular_hours ?? entry.hours ?? 0);
        const overtimeHours = Number(entry.overtime_hours ?? 0);
        const hourlyRate =
          Number(person?.hourly_rate ?? 0) ||
          Number(person?.day_rate ?? 0) / Math.max(Number(person?.paid_day_hours ?? 8), 1);
        return sum + regularHours * hourlyRate + overtimeHours * hourlyRate * 1.5;
      }, 0),
    [entries, peopleById],
  );

  const buildTimeEntryPayload = ({
    personId,
    date,
    startTime,
    endTime,
    lunchMinutes,
    status,
    workLocation,
    notes,
  }: {
    personId: number;
    date: string;
    startTime: string;
    endTime: string;
    lunchMinutes: number;
    status: string;
    workLocation: string;
    notes: string;
  }) => {
    const hours = calculateHours(startTime, endTime, lunchMinutes);
    const split = splitRegularOvertimeHours(hours, 8);
    return {
      person_id: personId,
      project_id: dealId,
      date,
      start_time: startTime || null,
      end_time: endTime || null,
      lunch_minutes: lunchMinutes,
      break_minutes: lunchMinutes,
      worked_hours_raw: Number((hours + lunchMinutes / 60).toFixed(2)),
      hours: Number(hours.toFixed(2)),
      payable_hours: Number(hours.toFixed(2)),
      regular_hours: split.regular,
      overtime_hours: split.overtime,
      day_type: "worked_day",
      status: status || "submitted",
      work_location: workLocation || null,
      notes: notes || null,
    };
  };

  const validateTimeDraft = ({
    personId,
    date,
    startTime,
    endTime,
    lunchMinutes,
  }: {
    personId?: number;
    date: string;
    startTime: string;
    endTime: string;
    lunchMinutes: number;
  }) => {
    const errors: Record<string, string> = {};
    if (!Number.isFinite(personId) || Number(personId) <= 0) {
      errors.person_id = "Select employee";
    }
    if (!date) errors.date = "Date is required";
    if (!startTime) errors.start_time = "Start is required";
    if (!endTime) errors.end_time = "End is required";
    if (startTime && endTime && calculateHours(startTime, endTime, lunchMinutes) <= 0) {
      errors.end_time = "End must be after start";
    }
    if (!Number.isFinite(lunchMinutes) || lunchMinutes < 0) {
      errors.lunch_minutes = "Lunch must be 0 or greater";
    }
    return errors;
  };

  const handleCreate = () => {
    const personId = Number(form.person_id);
    const lunch = Number(form.lunch_minutes || 0);
    const errors = validateTimeDraft({
      personId,
      date: form.date,
      startTime: form.start_time,
      endTime: form.end_time,
      lunchMinutes: lunch,
    });
    if (Object.keys(errors).length > 0) {
      notify(Object.values(errors)[0] || "Fix form errors", { type: "error" });
      return;
    }

    create(
      "time_entries",
      {
        data: buildTimeEntryPayload({
          personId,
          date: form.date,
          startTime: form.start_time,
          endTime: form.end_time,
          lunchMinutes: lunch,
          status: form.status,
          workLocation: form.work_location,
          notes: form.notes,
        }),
      },
      {
        onSuccess: () => {
          setForm({
            person_id: "",
            date: "",
            start_time: "",
            end_time: "",
            lunch_minutes: "30",
            status: "submitted",
            work_location: "",
            notes: "",
          });
          notify("Time entry added", { type: "info" });
          refresh();
        },
        onError: () => notify("Could not add time entry", { type: "error" }),
      },
    );
  };

  const startEdit = (entry: TimeEntry) => {
    setEditingId(Number(entry.id));
    setEditErrors({});
    setEditRow({
      date: entry.date ?? "",
      start_time: String(entry.start_time ?? "").slice(0, 5),
      end_time: String(entry.end_time ?? "").slice(0, 5),
      lunch_minutes: String(Number(entry.lunch_minutes ?? entry.break_minutes ?? 0)),
      status: entry.status,
      work_location: entry.work_location ?? "",
      notes: entry.notes ?? "",
    });
  };

  const saveEdit = (entry: TimeEntry) => {
    if (!editRow) return;
    const personId = Number(entry.person_id);
    const lunch = Number(editRow.lunch_minutes || 0);
    const errors = validateTimeDraft({
      personId,
      date: editRow.date,
      startTime: editRow.start_time,
      endTime: editRow.end_time,
      lunchMinutes: lunch,
    });
    if (Object.keys(errors).length > 0) {
      setEditErrors(errors);
      return;
    }
    setEditErrors({});
    update(
      "time_entries",
      {
        id: entry.id,
        data: buildTimeEntryPayload({
          personId,
          date: editRow.date,
          startTime: editRow.start_time,
          endTime: editRow.end_time,
          lunchMinutes: lunch,
          status: editRow.status,
          workLocation: editRow.work_location,
          notes: editRow.notes,
        }),
      },
      {
        onSuccess: () => {
          notify("Time entry updated", { type: "info" });
          setEditingId(null);
          setEditRow(null);
          refresh();
        },
        onError: () => notify("Could not update time entry", { type: "error" }),
      },
    );
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditErrors({});
    setEditRow(null);
  };

  if (isPending) return <EmptyDealTab label="Loading hours..." />;

  return (
    <div className="space-y-4">
      <InlineFormCard title="Add Time Entry">
        <div className="grid gap-2 md:grid-cols-2 lg:grid-cols-4">
          <div className="space-y-1">
            <div className="text-xs text-muted-foreground">Employee</div>
            <select
              className={cn(
                "h-9 w-full rounded-md border bg-background px-2 text-sm",
                !form.person_id ? "text-muted-foreground" : "",
              )}
              value={form.person_id}
              onChange={(event) =>
                setForm((prev) => ({ ...prev, person_id: event.target.value }))
              }
            >
              <option value="">Select employee</option>
              {(employeeOptions ?? []).map((person) => (
                <option key={person.id} value={String(person.id)}>
                  {[person.first_name, person.last_name].filter(Boolean).join(" ")}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1">
            <div className="text-xs text-muted-foreground">Date</div>
            <Input
              type="date"
              value={form.date}
              onChange={(event) => setForm((prev) => ({ ...prev, date: event.target.value }))}
            />
          </div>
          <div className="space-y-1">
            <div className="text-xs text-muted-foreground">Start</div>
            <Input
              type="time"
              value={form.start_time}
              onChange={(event) =>
                setForm((prev) => ({ ...prev, start_time: event.target.value }))
              }
            />
          </div>
          <div className="space-y-1">
            <div className="text-xs text-muted-foreground">End</div>
            <Input
              type="time"
              value={form.end_time}
              onChange={(event) => setForm((prev) => ({ ...prev, end_time: event.target.value }))}
            />
          </div>
          <div className="space-y-1">
            <div className="text-xs text-muted-foreground">Lunch (min)</div>
            <Input
              type="number"
              min={0}
              value={form.lunch_minutes}
              onChange={(event) =>
                setForm((prev) => ({ ...prev, lunch_minutes: event.target.value }))
              }
            />
          </div>
          <div className="space-y-1">
            <div className="text-xs text-muted-foreground">Status</div>
            <select
              className="h-9 w-full rounded-md border bg-background px-2 text-sm"
              value={form.status}
              onChange={(event) => setForm((prev) => ({ ...prev, status: event.target.value }))}
            >
              <option value="draft">Draft</option>
              <option value="submitted">Submitted</option>
              <option value="approved">Approved</option>
            </select>
          </div>
          <div className="space-y-1 md:col-span-2">
            <div className="text-xs text-muted-foreground">Address / Work location</div>
            <Input
              value={form.work_location}
              placeholder="Where was the work done?"
              onChange={(event) =>
                setForm((prev) => ({ ...prev, work_location: event.target.value }))
              }
            />
          </div>
          <div className="space-y-1 md:col-span-2">
            <div className="text-xs text-muted-foreground">Notes</div>
            <Input
              value={form.notes}
              placeholder="Optional note"
              onChange={(event) => setForm((prev) => ({ ...prev, notes: event.target.value }))}
            />
          </div>
        </div>
        <div className="mt-3 flex justify-end">
          <Button
            size="sm"
            onClick={handleCreate}
            disabled={isCreating}
            className="gap-1"
          >
            <Check className="h-4 w-4" />
            Add Time Entry
          </Button>
        </div>
      </InlineFormCard>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="text-sm text-muted-foreground">
          Total logged: <strong className="text-foreground">{totalHours.toFixed(2)}h</strong>
          {" · "}
          Regular: <strong className="text-foreground">{totalRegularHours.toFixed(2)}h</strong>
          {" · "}
          OT: <strong className="text-foreground">{totalOvertimeHours.toFixed(2)}h</strong>
          {" · "}
          Labor cost: <strong className="text-foreground">{toCurrency(totalLaborCost)}</strong>
        </div>
      </div>
      {!entries?.length ? <EmptyDealTab label="No hours linked to this project yet." /> : null}
      <div className="overflow-x-auto rounded-md border">
        <table className="min-w-full text-sm">
          <thead className="bg-muted/40">
            <tr>
              <th className="px-3 py-2 text-left font-medium">Date</th>
              <th className="px-3 py-2 text-left font-medium">Employee</th>
              <th className="px-3 py-2 text-left font-medium">Start</th>
              <th className="px-3 py-2 text-left font-medium">Lunch</th>
              <th className="px-3 py-2 text-left font-medium">End</th>
              <th className="px-3 py-2 text-left font-medium">Hours</th>
              <th className="px-3 py-2 text-left font-medium">Overtime</th>
              <th className="px-3 py-2 text-left font-medium">Labor cost</th>
              <th className="px-3 py-2 text-left font-medium">Status</th>
              <th className="px-3 py-2 text-left font-medium">Address</th>
              <th className="px-3 py-2 text-left font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {(entries ?? []).map((entry) => {
              const isEditing = editingId === Number(entry.id);
              const lunchMinutes = Number(
                (isEditing ? editRow?.lunch_minutes : entry.lunch_minutes) ??
                  entry.break_minutes ??
                  0,
              );
              const startTime = (isEditing ? editRow?.start_time : entry.start_time) ?? "";
              const endTime = (isEditing ? editRow?.end_time : entry.end_time) ?? "";
              const computedHours = calculateHours(startTime, endTime, lunchMinutes);
              const computedSplit = splitRegularOvertimeHours(computedHours, 8);
              const person = peopleById[entry.person_id];
              const rate =
                Number(person?.hourly_rate ?? 0) ||
                Number(person?.day_rate ?? 0) / Math.max(Number(person?.paid_day_hours ?? 8), 1);
              const computedLaborCost =
                computedSplit.regular * rate + computedSplit.overtime * rate * 1.5;

              return (
                <tr key={entry.id} className="border-t">
                  <td className="px-3 py-2">
                    {isEditing ? (
                      <Input
                        type="date"
                        value={editRow?.date ?? ""}
                        className={cn("h-8 min-w-[140px]", editErrors.date ? "border-red-500" : "")}
                        onChange={(event) =>
                          setEditRow((prev) =>
                            prev ? { ...prev, date: event.target.value } : prev,
                          )
                        }
                      />
                    ) : (
                      toDayDateLabel(entry.date)
                    )}
                  </td>
                  <td className="px-3 py-2">
                    {peopleById[entry.person_id]
                      ? `${peopleById[entry.person_id].first_name} ${peopleById[entry.person_id].last_name}`
                      : "—"}
                  </td>
                  <td className="px-3 py-2">
                    {isEditing ? (
                      <Input
                        type="time"
                        value={editRow?.start_time ?? ""}
                        className={cn(
                          "h-8 min-w-[110px]",
                          editErrors.start_time ? "border-red-500" : "",
                        )}
                        onChange={(event) =>
                          setEditRow((prev) =>
                            prev ? { ...prev, start_time: event.target.value } : prev,
                          )
                        }
                      />
                    ) : (
                      entry.start_time?.slice(0, 5) || "—"
                    )}
                  </td>
                  <td className="px-3 py-2">
                    {isEditing ? (
                      <Input
                        type="number"
                        min={0}
                        value={editRow?.lunch_minutes ?? "0"}
                        className={cn(
                          "h-8 w-20",
                          editErrors.lunch_minutes ? "border-red-500" : "",
                        )}
                        onChange={(event) =>
                          setEditRow((prev) =>
                            prev ? { ...prev, lunch_minutes: event.target.value } : prev,
                          )
                        }
                      />
                    ) : (
                      Number(entry.lunch_minutes ?? entry.break_minutes ?? 0)
                    )}
                  </td>
                  <td className="px-3 py-2">
                    {isEditing ? (
                      <Input
                        type="time"
                        value={editRow?.end_time ?? ""}
                        className={cn(
                          "h-8 min-w-[110px]",
                          editErrors.end_time ? "border-red-500" : "",
                        )}
                        onChange={(event) =>
                          setEditRow((prev) =>
                            prev ? { ...prev, end_time: event.target.value } : prev,
                          )
                        }
                      />
                    ) : (
                      entry.end_time?.slice(0, 5) || "—"
                    )}
                  </td>
                  <td className="px-3 py-2">{Number((isEditing ? computedHours : entry.hours) ?? 0).toFixed(2)}</td>
                  <td className="px-3 py-2">
                    {Number(
                      (isEditing ? computedSplit.overtime : entry.overtime_hours) ?? 0,
                    ).toFixed(2)}
                  </td>
                  <td className="px-3 py-2">{toCurrency(isEditing ? computedLaborCost : (Number(entry.regular_hours ?? entry.hours ?? 0) + Number(entry.overtime_hours ?? 0) * 1.5) * rate)}</td>
                  <td className="px-3 py-2">
                    {isEditing ? (
                      <select
                        className="h-8 rounded-md border bg-background px-2 text-sm"
                        value={editRow?.status ?? "submitted"}
                        onChange={(event) =>
                          setEditRow((prev) =>
                            prev ? { ...prev, status: event.target.value } : prev,
                          )
                        }
                      >
                        <option value="draft">draft</option>
                        <option value="submitted">submitted</option>
                        <option value="approved">approved</option>
                        <option value="rejected">rejected</option>
                        <option value="included_in_payroll">included_in_payroll</option>
                        <option value="paid">paid</option>
                      </select>
                    ) : (
                      entry.status
                    )}
                  </td>
                  <td className="px-3 py-2">
                    {isEditing ? (
                      <Input
                        value={editRow?.work_location ?? ""}
                        className="h-8 min-w-[180px]"
                        placeholder="Address"
                        onChange={(event) =>
                          setEditRow((prev) =>
                            prev ? { ...prev, work_location: event.target.value } : prev,
                          )
                        }
                      />
                    ) : (
                      entry.work_location || "—"
                    )}
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex items-center gap-1">
                      {isEditing ? (
                        <>
                          <Button
                            type="button"
                            size="icon"
                            variant="ghost"
                            className="h-8 w-8"
                            onClick={() => saveEdit(entry)}
                            disabled={isUpdating}
                          >
                            <Check className="h-4 w-4 text-emerald-600" />
                          </Button>
                          <Button
                            type="button"
                            size="icon"
                            variant="ghost"
                            className="h-8 w-8"
                            onClick={cancelEdit}
                            disabled={isUpdating}
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </>
                      ) : (
                        <Button
                          type="button"
                          size="icon"
                          variant="ghost"
                          className="h-8 w-8"
                          onClick={() => startEdit(entry)}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};

const DealSubcontractorsTab = ({ dealId }: { dealId: Deal["id"] }) => {
  const [create, { isPending: isCreating }] = useCreate();
  const [update, { isPending: isUpdating }] = useUpdate();
  const [removeOne, { isPending: isDeleting }] = useDelete();
  const notify = useNotify();
  const refresh = useRefresh();
  const [files, setFiles] = useState<File[]>([]);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editErrors, setEditErrors] = useState<Record<string, string>>({});
  const [editRow, setEditRow] = useState<{
    status: string;
    invoice_number: string;
    cost_amount: string;
    material_included: boolean;
    start_date: string;
    estimated_completion_date: string;
    notes: string;
  } | null>(null);
  const [form, setForm] = useState({
    person_id: "",
    status: "pending",
    invoice_number: "",
    cost_amount: "",
    material_included: false,
    start_date: "",
    estimated_completion_date: "",
    notes: "",
  });
  const { data: entries, isPending } = useGetList<DealSubcontractorEntry>(
    "deal_subcontractor_entries",
    {
      filter: { "deal_id@eq": dealId },
      pagination: { page: 1, perPage: 500 },
      sort: { field: "created_at", order: "DESC" },
    },
    { staleTime: 30_000 },
  );
  const { data: people } = useGetList<Person>(
    "people",
    {
      filter: { "type@eq": "subcontractor" },
      pagination: { page: 1, perPage: 500 },
      sort: { field: "last_name", order: "ASC" },
    },
    { staleTime: 30_000 },
  );
  const peopleById = useMemo(
    () => Object.fromEntries((people ?? []).map((person) => [Number(person.id), person])),
    [people],
  );
  const totalCost = useMemo(
    () => (entries ?? []).reduce((sum, entry) => sum + Number(entry.cost_amount ?? 0), 0),
    [entries],
  );
  const pendingPayments = useMemo(
    () =>
      (entries ?? []).filter(
        (entry) => entry.status !== "paid" && entry.status !== "completed",
      ).length,
    [entries],
  );

  const handleCreate = () => {
    const personId = Number(form.person_id);
    const cost = Number(form.cost_amount);
    if (!Number.isFinite(personId) || personId <= 0) {
      notify("Select a subcontractor", { type: "error" });
      return;
    }
    if (!Number.isFinite(cost) || cost < 0) {
      notify("Enter a valid cost", { type: "error" });
      return;
    }
    create(
      "deal_subcontractor_entries",
      {
        data: {
          deal_id: dealId,
          person_id: personId,
          status: form.status,
          invoice_number: form.invoice_number || null,
          cost_amount: cost,
          material_included: form.material_included,
          start_date: form.start_date || null,
          estimated_completion_date: form.estimated_completion_date || null,
          notes: form.notes || null,
          invoice_attachments: files.map((file) => ({
            rawFile: file,
            src: URL.createObjectURL(file),
            title: file.name,
            type: file.type,
          })),
        },
      },
      {
        onSuccess: () => {
          setForm({
            person_id: "",
            status: "pending",
            invoice_number: "",
            cost_amount: "",
            material_included: false,
            start_date: "",
            estimated_completion_date: "",
            notes: "",
          });
          setFiles([]);
          refresh();
          notify("Subcontractor entry added", { type: "info" });
        },
        onError: () => notify("Could not add subcontractor entry", { type: "error" }),
      },
    );
  };

  const startEdit = (entry: DealSubcontractorEntry) => {
    setEditingId(Number(entry.id));
    setEditErrors({});
    setEditRow({
      status: entry.status,
      invoice_number: entry.invoice_number || "",
      cost_amount: String(entry.cost_amount ?? 0),
      material_included: !!entry.material_included,
      start_date: entry.start_date || "",
      estimated_completion_date: entry.estimated_completion_date || "",
      notes: entry.notes || "",
    });
  };

  const saveEdit = (entry: DealSubcontractorEntry) => {
    if (!editRow) return;
    const nextCost = Number(editRow.cost_amount);
    const errors: Record<string, string> = {};
    if (!Number.isFinite(nextCost) || nextCost < 0) {
      errors.cost_amount = "Cost must be 0 or greater";
    }
    if (!editRow.status) {
      errors.status = "Status is required";
    }
    if (Object.keys(errors).length > 0) {
      setEditErrors(errors);
      return;
    }
    setEditErrors({});
    update(
      "deal_subcontractor_entries",
      {
        id: entry.id,
        data: {
          status: editRow.status,
          invoice_number: editRow.invoice_number || null,
          cost_amount: nextCost,
          material_included: editRow.material_included,
          start_date: editRow.start_date || null,
          estimated_completion_date: editRow.estimated_completion_date || null,
          notes: editRow.notes || null,
        },
        previousData: entry,
      },
      {
        onSuccess: () => {
          setEditingId(null);
          setEditRow(null);
          setEditErrors({});
          refresh();
          notify(`Subcontractor entry #${entry.id} updated`, { type: "info" });
        },
        onError: () => notify("Could not update subcontractor entry", { type: "error" }),
      },
    );
  };

  const deleteRow = (entry: DealSubcontractorEntry) => {
    removeOne(
      "deal_subcontractor_entries",
      { id: entry.id, previousData: entry },
      {
        onSuccess: () => {
          refresh();
          notify(`Subcontractor entry #${entry.id} deleted`, { type: "info" });
        },
        onError: () => notify("Could not delete subcontractor entry", { type: "error" }),
      },
    );
  };

  if (isPending) return <EmptyDealTab label="Loading subcontractors..." />;
  const hasRows = (entries ?? []).length > 0;

  return (
    <div className="space-y-4">
      <InlineFormCard title="Add Subcontractor">
        <div className="grid gap-2 md:grid-cols-2">
          <select
            className="h-9 rounded-md border bg-background px-3 text-sm"
            value={form.person_id}
            onChange={(event) =>
              setForm((prev) => ({ ...prev, person_id: event.target.value }))
            }
          >
            <option value="">Select subcontractor</option>
            {(people ?? []).map((person) => (
              <option key={person.id} value={String(person.id)}>
                {person.business_name ||
                  `${person.first_name || ""} ${person.last_name || ""}`.trim()}
              </option>
            ))}
          </select>
          <select
            className="h-9 rounded-md border bg-background px-3 text-sm"
            value={form.status}
            onChange={(event) => setForm((prev) => ({ ...prev, status: event.target.value }))}
          >
            <option value="pending">Pending</option>
            <option value="approved">Approved</option>
            <option value="in_progress">In Progress</option>
            <option value="completed">Completed</option>
            <option value="paid">Paid</option>
          </select>
          <Input
            placeholder="Invoice number"
            value={form.invoice_number}
            onChange={(event) =>
              setForm((prev) => ({ ...prev, invoice_number: event.target.value }))
            }
          />
          <Input
            type="number"
            min={0}
            step="0.01"
            placeholder="Cost"
            value={form.cost_amount}
            onChange={(event) =>
              setForm((prev) => ({ ...prev, cost_amount: event.target.value }))
            }
          />
          <Input
            type="date"
            value={form.start_date}
            onChange={(event) => setForm((prev) => ({ ...prev, start_date: event.target.value }))}
          />
          <Input
            type="date"
            value={form.estimated_completion_date}
            onChange={(event) =>
              setForm((prev) => ({ ...prev, estimated_completion_date: event.target.value }))
            }
          />
          <label className="flex items-center gap-2 text-sm text-muted-foreground md:col-span-2">
            <input
              type="checkbox"
              checked={form.material_included}
              onChange={(event) =>
                setForm((prev) => ({ ...prev, material_included: event.target.checked }))
              }
            />
            Material included
          </label>
          <Input
            type="file"
            multiple
            onChange={(event) => setFiles(Array.from(event.target.files ?? []))}
            className="md:col-span-2"
          />
          <Textarea
            placeholder="Notes"
            value={form.notes}
            onChange={(event) => setForm((prev) => ({ ...prev, notes: event.target.value }))}
            className="md:col-span-2"
          />
        </div>
        <div className="mt-3 flex justify-end">
          <Button type="button" size="sm" onClick={handleCreate} disabled={isCreating}>
            Add Subcontractor
          </Button>
        </div>
      </InlineFormCard>

      <div className="text-sm text-muted-foreground">
        Total subcontractor cost: <strong className="text-foreground">{toCurrency(totalCost)}</strong>
        {" · "}
        Total records: <strong className="text-foreground">{entries?.length ?? 0}</strong>
        {" · "}
        Pending payments: <strong className="text-foreground">{pendingPayments}</strong>
      </div>

      {hasRows ? (
        <div className="overflow-x-auto rounded-md border">
          <table className="min-w-full text-sm">
            <thead className="bg-muted/40">
              <tr>
                <th className="px-3 py-2 text-left font-medium">Subcontractor</th>
                <th className="px-3 py-2 text-left font-medium">Invoice</th>
                <th className="px-3 py-2 text-left font-medium">Amount</th>
                <th className="px-3 py-2 text-left font-medium">Material included</th>
                <th className="px-3 py-2 text-left font-medium">Start date</th>
                <th className="px-3 py-2 text-left font-medium">Estimated completion</th>
                <th className="px-3 py-2 text-left font-medium">Status</th>
                <th className="px-3 py-2 text-left font-medium">Notes</th>
                <th className="px-3 py-2 text-left font-medium">Documents</th>
                <th className="px-3 py-2 text-right font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {(entries ?? []).map((entry) => (
                <tr key={entry.id} className="border-t">
                  <td className="px-3 py-2">
                    {peopleById[Number(entry.person_id)]?.business_name ||
                      `${peopleById[Number(entry.person_id)]?.first_name || ""} ${
                        peopleById[Number(entry.person_id)]?.last_name || ""
                      }`.trim() ||
                      "—"}
                  </td>
                  <td className="px-3 py-2">
                    {editingId === Number(entry.id) ? (
                      <Input
                        className={cn(editErrors.invoice_number ? "border-red-500" : "")}
                        value={editRow?.invoice_number ?? ""}
                        onChange={(event) =>
                          setEditRow((prev) =>
                            prev ? { ...prev, invoice_number: event.target.value } : prev,
                          )
                        }
                      />
                    ) : (
                      entry.invoice_number || "—"
                    )}
                  </td>
                  <td className="px-3 py-2">
                    {editingId === Number(entry.id) ? (
                      <Input
                        type="number"
                        min={0}
                        step="0.01"
                        className={cn(editErrors.cost_amount ? "border-red-500" : "")}
                        value={editRow?.cost_amount ?? ""}
                        onChange={(event) =>
                          setEditRow((prev) =>
                            prev ? { ...prev, cost_amount: event.target.value } : prev,
                          )
                        }
                      />
                    ) : (
                      toCurrency(Number(entry.cost_amount ?? 0))
                    )}
                  </td>
                  <td className="px-3 py-2">
                    {editingId === Number(entry.id) ? (
                      <label className="flex items-center gap-2 text-xs text-muted-foreground">
                        <input
                          type="checkbox"
                          checked={!!editRow?.material_included}
                          onChange={(event) =>
                            setEditRow((prev) =>
                              prev
                                ? { ...prev, material_included: event.target.checked }
                                : prev,
                            )
                          }
                        />
                        included
                      </label>
                    ) : entry.material_included ? (
                      "Yes"
                    ) : (
                      "No"
                    )}
                  </td>
                  <td className="px-3 py-2">
                    {editingId === Number(entry.id) ? (
                      <Input
                        type="date"
                        value={editRow?.start_date ?? ""}
                        onChange={(event) =>
                          setEditRow((prev) =>
                            prev ? { ...prev, start_date: event.target.value } : prev,
                          )
                        }
                      />
                    ) : (
                      toDateLabel(entry.start_date)
                    )}
                  </td>
                  <td className="px-3 py-2">
                    {editingId === Number(entry.id) ? (
                      <Input
                        type="date"
                        value={editRow?.estimated_completion_date ?? ""}
                        onChange={(event) =>
                          setEditRow((prev) =>
                            prev
                              ? { ...prev, estimated_completion_date: event.target.value }
                              : prev,
                          )
                        }
                      />
                    ) : (
                      toDateLabel(entry.estimated_completion_date)
                    )}
                  </td>
                  <td className="px-3 py-2">
                    {editingId === Number(entry.id) ? (
                      <select
                        className={cn(
                          "h-8 rounded-md border bg-background px-2 text-xs",
                          editErrors.status ? "border-red-500" : "",
                        )}
                        value={editRow?.status ?? "pending"}
                        onChange={(event) =>
                          setEditRow((prev) =>
                            prev ? { ...prev, status: event.target.value } : prev,
                          )
                        }
                      >
                        <option value="pending">Pending</option>
                        <option value="approved">Approved</option>
                        <option value="in_progress">In Progress</option>
                        <option value="completed">Completed</option>
                        <option value="paid">Paid</option>
                      </select>
                    ) : (
                      entry.status
                    )}
                  </td>
                  <td className="px-3 py-2">
                    {editingId === Number(entry.id) ? (
                      <ExpandableTextCellEditor
                        value={editRow?.notes ?? ""}
                        placeholder="Notes"
                        onChange={(next) =>
                          setEditRow((prev) => (prev ? { ...prev, notes: next } : prev))
                        }
                      />
                    ) : (
                      <TextPreview value={entry.notes} />
                    )}
                  </td>
                  <td className="px-3 py-2">{entry.invoice_attachments?.length ?? 0}</td>
                  <td className="px-3 py-2">
                    <div className="flex items-center justify-end gap-1">
                      {editingId === Number(entry.id) ? (
                        <>
                          <Button
                            type="button"
                            size="icon"
                            variant="ghost"
                            className="h-7 w-7"
                            disabled={isUpdating}
                            onClick={() => saveEdit(entry)}
                          >
                            <Check className="h-4 w-4" />
                          </Button>
                          <Button
                            type="button"
                            size="icon"
                            variant="ghost"
                            className="h-7 w-7"
                          onClick={() => {
                              setEditingId(null);
                              setEditRow(null);
                              setEditErrors({});
                            }}
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </>
                      ) : (
                        <>
                          <Button
                            type="button"
                            size="icon"
                            variant="ghost"
                            className="h-7 w-7"
                            onClick={() => startEdit(entry)}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            type="button"
                            size="icon"
                            variant="ghost"
                            className="h-7 w-7 text-red-600"
                            disabled={isDeleting}
                            onClick={() => deleteRow(entry)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                          {Object.values(editErrors).length > 0 ? (
                            <div className="px-2 text-[11px] text-red-600">
                              {Object.values(editErrors)[0]}
                            </div>
                          ) : null}
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <EmptyDealTab label="No subcontractors linked yet." />
      )}
    </div>
  );
};

const DealExpensesTab = ({ dealId }: { dealId: Deal["id"] }) => {
  const [create, { isPending: isCreating }] = useCreate();
  const [update, { isPending: isUpdating }] = useUpdate();
  const [removeOne, { isPending: isDeleting }] = useDelete();
  const notify = useNotify();
  const refresh = useRefresh();
  const [files, setFiles] = useState<File[]>([]);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editErrors, setEditErrors] = useState<Record<string, string>>({});
  const [editRow, setEditRow] = useState<{
    expense_type: string;
    vendor: string;
    description: string;
    amount: string;
    purchase_date: string;
    paid: boolean;
    notes: string;
  } | null>(null);
  const [form, setForm] = useState({
    expense_type: "material",
    vendor: "",
    description: "",
    amount: "",
    purchase_date: "",
    paid: false,
    notes: "",
  });
  const { data: expenses = [], isPending } = useGetList<DealExpense>(
    "deal_expenses",
    {
      filter: { "deal_id@eq": dealId },
      pagination: { page: 1, perPage: 500 },
      sort: { field: "purchase_date", order: "DESC" },
    },
    { staleTime: 30_000 },
  );
  const totalExpenses = useMemo(
    () => expenses.reduce((sum, entry) => sum + Number(entry.amount ?? 0), 0),
    [expenses],
  );
  const paidExpenses = useMemo(
    () =>
      expenses
        .filter((entry) => entry.paid)
        .reduce((sum, entry) => sum + Number(entry.amount ?? 0), 0),
    [expenses],
  );

  const handleCreate = () => {
    const amount = Number(form.amount);
    if (!Number.isFinite(amount) || amount < 0) {
      notify("Enter a valid amount", { type: "error" });
      return;
    }
    create(
      "deal_expenses",
      {
        data: {
          deal_id: dealId,
          expense_type: form.expense_type,
          vendor: form.vendor || null,
          description: form.description || null,
          amount,
          purchase_date: form.purchase_date || null,
          paid: form.paid,
          notes: form.notes || null,
          attachments: files.map((file) => ({
            rawFile: file,
            src: URL.createObjectURL(file),
            title: file.name,
            type: file.type,
          })),
        },
      },
      {
        onSuccess: () => {
          setForm({
            expense_type: "material",
            vendor: "",
            description: "",
            amount: "",
            purchase_date: "",
            paid: false,
            notes: "",
          });
          setFiles([]);
          refresh();
          notify("Expense added", { type: "info" });
        },
        onError: () => notify("Could not add expense", { type: "error" }),
      },
    );
  };

  const startEdit = (entry: DealExpense) => {
    setEditingId(Number(entry.id));
    setEditErrors({});
    setEditRow({
      expense_type: entry.expense_type,
      vendor: entry.vendor || "",
      description: entry.description || "",
      amount: String(entry.amount ?? 0),
      purchase_date: entry.purchase_date || "",
      paid: !!entry.paid,
      notes: entry.notes || "",
    });
  };

  const saveEdit = (entry: DealExpense) => {
    if (!editRow) return;
    const amount = Number(editRow.amount);
    const errors: Record<string, string> = {};
    if (!editRow.expense_type.trim()) {
      errors.expense_type = "Type is required";
    }
    if (!Number.isFinite(amount) || amount < 0) {
      errors.amount = "Amount must be 0 or greater";
    }
    if (Object.keys(errors).length > 0) {
      setEditErrors(errors);
      return;
    }
    setEditErrors({});
    update(
      "deal_expenses",
      {
        id: entry.id,
        data: {
          expense_type: editRow.expense_type,
          vendor: editRow.vendor || null,
          description: editRow.description || null,
          amount,
          purchase_date: editRow.purchase_date || null,
          paid: editRow.paid,
          notes: editRow.notes || null,
        },
        previousData: entry,
      },
      {
        onSuccess: () => {
          setEditingId(null);
          setEditRow(null);
          setEditErrors({});
          refresh();
          notify(`Expense #${entry.id} updated`, { type: "info" });
        },
        onError: () => notify("Could not update expense", { type: "error" }),
      },
    );
  };

  const deleteRow = (entry: DealExpense) => {
    removeOne(
      "deal_expenses",
      { id: entry.id, previousData: entry },
      {
        onSuccess: () => {
          refresh();
          notify(`Expense #${entry.id} deleted`, { type: "info" });
        },
        onError: () => notify("Could not delete expense", { type: "error" }),
      },
    );
  };

  if (isPending) return <EmptyDealTab label="Loading expenses..." />;
  return (
    <div className="space-y-4">
      <InlineFormCard title="Add Expense">
        <div className="grid gap-2 md:grid-cols-2">
          <select
            className="h-9 rounded-md border bg-background px-3 text-sm"
            value={form.expense_type}
            onChange={(event) =>
              setForm((prev) => ({ ...prev, expense_type: event.target.value }))
            }
          >
            <option value="material">Material</option>
            <option value="equipment">Equipment</option>
            <option value="permit">Permit</option>
            <option value="dump_fee">Dump fee</option>
            <option value="delivery">Delivery</option>
            <option value="other">Other</option>
          </select>
          <Input
            placeholder="Vendor / store"
            value={form.vendor}
            onChange={(event) => setForm((prev) => ({ ...prev, vendor: event.target.value }))}
          />
          <Input
            placeholder="Description"
            value={form.description}
            onChange={(event) =>
              setForm((prev) => ({ ...prev, description: event.target.value }))
            }
          />
          <Input
            type="number"
            min={0}
            step="0.01"
            placeholder="Amount"
            value={form.amount}
            onChange={(event) => setForm((prev) => ({ ...prev, amount: event.target.value }))}
          />
          <Input
            type="date"
            value={form.purchase_date}
            onChange={(event) =>
              setForm((prev) => ({ ...prev, purchase_date: event.target.value }))
            }
          />
          <label className="flex items-center gap-2 text-sm text-muted-foreground">
            <input
              type="checkbox"
              checked={form.paid}
              onChange={(event) => setForm((prev) => ({ ...prev, paid: event.target.checked }))}
            />
            Paid
          </label>
          <Input
            type="file"
            multiple
            onChange={(event) => setFiles(Array.from(event.target.files ?? []))}
            className="md:col-span-2"
          />
          <Textarea
            placeholder="Notes"
            value={form.notes}
            onChange={(event) => setForm((prev) => ({ ...prev, notes: event.target.value }))}
            className="md:col-span-2"
          />
        </div>
        <div className="mt-3 flex justify-end">
          <Button type="button" size="sm" onClick={handleCreate} disabled={isCreating}>
            Add Expense
          </Button>
        </div>
      </InlineFormCard>

      <div className="text-sm text-muted-foreground">
        Total expenses: <strong className="text-foreground">{toCurrency(totalExpenses)}</strong>
        {" · "}
        Paid: <strong className="text-foreground">{toCurrency(paidExpenses)}</strong>
        {" · "}
        Unpaid: <strong className="text-foreground">{toCurrency(totalExpenses - paidExpenses)}</strong>
      </div>

      {expenses.length === 0 ? (
        <EmptyDealTab label="No expenses linked to this project yet." />
      ) : (
        <div className="overflow-x-auto rounded-md border">
          <table className="min-w-full text-sm">
            <thead className="bg-muted/40">
              <tr>
                <th className="px-3 py-2 text-left font-medium">Type</th>
                <th className="px-3 py-2 text-left font-medium">Vendor</th>
                <th className="px-3 py-2 text-left font-medium">Description</th>
                <th className="px-3 py-2 text-left font-medium">Amount</th>
                <th className="px-3 py-2 text-left font-medium">Purchase date</th>
                <th className="px-3 py-2 text-left font-medium">Paid</th>
                <th className="px-3 py-2 text-left font-medium">Notes</th>
                <th className="px-3 py-2 text-left font-medium">Attachments</th>
                <th className="px-3 py-2 text-right font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {expenses.map((entry) => (
                <tr key={entry.id} className="border-t">
                  <td className="px-3 py-2">
                    {editingId === Number(entry.id) ? (
                      <Input
                        className={cn(editErrors.expense_type ? "border-red-500" : "")}
                        value={editRow?.expense_type ?? ""}
                        onChange={(event) =>
                          setEditRow((prev) =>
                            prev ? { ...prev, expense_type: event.target.value } : prev,
                          )
                        }
                      />
                    ) : (
                      entry.expense_type
                    )}
                  </td>
                  <td className="px-3 py-2">
                    {editingId === Number(entry.id) ? (
                      <Input
                        value={editRow?.vendor ?? ""}
                        onChange={(event) =>
                          setEditRow((prev) => (prev ? { ...prev, vendor: event.target.value } : prev))
                        }
                      />
                    ) : (
                      entry.vendor || "—"
                    )}
                  </td>
                  <td className="px-3 py-2">
                    {editingId === Number(entry.id) ? (
                      <ExpandableTextCellEditor
                        value={editRow?.description ?? ""}
                        placeholder="Description"
                        onChange={(next) =>
                          setEditRow((prev) =>
                            prev ? { ...prev, description: next } : prev,
                          )
                        }
                      />
                    ) : (
                      <TextPreview value={entry.description} />
                    )}
                  </td>
                  <td className="px-3 py-2">
                    {editingId === Number(entry.id) ? (
                      <Input
                        type="number"
                        min={0}
                        step="0.01"
                        className={cn(editErrors.amount ? "border-red-500" : "")}
                        value={editRow?.amount ?? ""}
                        onChange={(event) =>
                          setEditRow((prev) => (prev ? { ...prev, amount: event.target.value } : prev))
                        }
                      />
                    ) : (
                      toCurrency(Number(entry.amount ?? 0))
                    )}
                  </td>
                  <td className="px-3 py-2">
                    {editingId === Number(entry.id) ? (
                      <Input
                        type="date"
                        value={editRow?.purchase_date ?? ""}
                        onChange={(event) =>
                          setEditRow((prev) =>
                            prev ? { ...prev, purchase_date: event.target.value } : prev,
                          )
                        }
                      />
                    ) : (
                      toDateLabel(entry.purchase_date)
                    )}
                  </td>
                  <td className="px-3 py-2">
                    {editingId === Number(entry.id) ? (
                      <label className="flex items-center gap-2 text-xs text-muted-foreground">
                        <input
                          type="checkbox"
                          checked={!!editRow?.paid}
                          onChange={(event) =>
                            setEditRow((prev) => (prev ? { ...prev, paid: event.target.checked } : prev))
                          }
                        />
                        paid
                      </label>
                    ) : entry.paid ? (
                      "Yes"
                    ) : (
                      "No"
                    )}
                  </td>
                  <td className="px-3 py-2">
                    {editingId === Number(entry.id) ? (
                      <ExpandableTextCellEditor
                        value={editRow?.notes ?? ""}
                        placeholder="Notes"
                        onChange={(next) =>
                          setEditRow((prev) => (prev ? { ...prev, notes: next } : prev))
                        }
                      />
                    ) : (
                      <TextPreview value={entry.notes} />
                    )}
                  </td>
                  <td className="px-3 py-2">{entry.attachments?.length ?? 0}</td>
                  <td className="px-3 py-2">
                    <div className="flex items-center justify-end gap-1">
                      {editingId === Number(entry.id) ? (
                        <>
                          <Button
                            type="button"
                            size="icon"
                            variant="ghost"
                            className="h-7 w-7"
                            disabled={isUpdating}
                            onClick={() => saveEdit(entry)}
                          >
                            <Check className="h-4 w-4" />
                          </Button>
                          <Button
                            type="button"
                            size="icon"
                            variant="ghost"
                            className="h-7 w-7"
                            onClick={() => {
                              setEditingId(null);
                              setEditRow(null);
                              setEditErrors({});
                            }}
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </>
                      ) : (
                        <>
                          <Button
                            type="button"
                            size="icon"
                            variant="ghost"
                            className="h-7 w-7"
                            onClick={() => startEdit(entry)}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            type="button"
                            size="icon"
                            variant="ghost"
                            className="h-7 w-7 text-red-600"
                            disabled={isDeleting}
                            onClick={() => deleteRow(entry)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                          {Object.values(editErrors).length > 0 ? (
                            <div className="px-2 text-[11px] text-red-600">
                              {Object.values(editErrors)[0]}
                            </div>
                          ) : null}
                        </>
                      )}
                    </div>
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

const DealPaymentsTab = ({
  dealId,
}: {
  dealId: Deal["id"];
}) => {
  const [create, { isPending: isCreating }] = useCreate();
  const [update, { isPending: isUpdating }] = useUpdate();
  const [removeOne, { isPending: isDeleting }] = useDelete();
  const notify = useNotify();
  const refresh = useRefresh();
  const [files, setFiles] = useState<File[]>([]);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editErrors, setEditErrors] = useState<Record<string, string>>({});
  const [editRow, setEditRow] = useState<{
    payment_date: string;
    amount: string;
    payment_method: string;
    check_number: string;
    reference_number: string;
    status: string;
    notes: string;
  } | null>(null);
  const [form, setForm] = useState({
    payment_date: "",
    amount: "",
    payment_method: "check",
    check_number: "",
    reference_number: "",
    status: "pending",
    notes: "",
  });
  const { data: payments = [], isPending } = useGetList<DealClientPayment>(
    "deal_client_payments",
    {
      filter: { "deal_id@eq": dealId },
      pagination: { page: 1, perPage: 500 },
      sort: { field: "payment_date", order: "DESC" },
    },
    { staleTime: 30_000 },
  );

  const totalCollected = useMemo(
    () =>
      payments
        .filter((payment) => payment.status === "cleared" || payment.status === "deposited")
        .reduce((sum, payment) => sum + Number(payment.amount ?? 0), 0),
    [payments],
  );
  const totalPending = useMemo(
    () =>
      payments
        .filter((payment) => payment.status === "pending")
        .reduce((sum, payment) => sum + Number(payment.amount ?? 0), 0),
    [payments],
  );
  const totalBounced = useMemo(
    () =>
      payments
        .filter((payment) => payment.status === "bounced")
        .reduce((sum, payment) => sum + Number(payment.amount ?? 0), 0),
    [payments],
  );

  const handleCreate = () => {
    const amount = Number(form.amount);
    if (!form.payment_date) {
      notify("Select payment date", { type: "error" });
      return;
    }
    if (!Number.isFinite(amount) || amount <= 0) {
      notify("Enter a valid amount", { type: "error" });
      return;
    }
    create(
      "deal_client_payments",
      {
        data: {
          deal_id: dealId,
          payment_date: form.payment_date,
          amount,
          payment_method: form.payment_method,
          check_number: form.check_number || null,
          reference_number: form.reference_number || null,
          status: form.status,
          notes: form.notes || null,
          attachments: files.map((file) => ({
            rawFile: file,
            src: URL.createObjectURL(file),
            title: file.name,
            type: file.type,
          })),
        },
      },
      {
        onSuccess: () => {
          setForm({
            payment_date: "",
            amount: "",
            payment_method: "check",
            check_number: "",
            reference_number: "",
            status: "pending",
            notes: "",
          });
          setFiles([]);
          refresh();
          notify("Payment added", { type: "info" });
        },
        onError: () => notify("Could not add payment", { type: "error" }),
      },
    );
  };

  const startEdit = (payment: DealClientPayment) => {
    setEditingId(Number(payment.id));
    setEditErrors({});
    setEditRow({
      payment_date: payment.payment_date || "",
      amount: String(payment.amount ?? 0),
      payment_method: payment.payment_method,
      check_number: payment.check_number || "",
      reference_number: payment.reference_number || "",
      status: payment.status,
      notes: payment.notes || "",
    });
  };

  const saveEdit = (payment: DealClientPayment) => {
    if (!editRow) return;
    const amount = Number(editRow.amount);
    const errors: Record<string, string> = {};
    if (!editRow.payment_date) {
      errors.payment_date = "Date is required";
    }
    if (!Number.isFinite(amount) || amount <= 0) {
      errors.amount = "Amount must be greater than 0";
    }
    if (!editRow.status) {
      errors.status = "Status is required";
    }
    if (Object.keys(errors).length > 0) {
      setEditErrors(errors);
      return;
    }
    setEditErrors({});
    update(
      "deal_client_payments",
      {
        id: payment.id,
        data: {
          payment_date: editRow.payment_date,
          amount,
          payment_method: editRow.payment_method,
          check_number: editRow.check_number || null,
          reference_number: editRow.reference_number || null,
          status: editRow.status,
          notes: editRow.notes || null,
        },
        previousData: payment,
      },
      {
        onSuccess: () => {
          setEditingId(null);
          setEditRow(null);
          setEditErrors({});
          refresh();
          notify(`Payment #${payment.id} updated`, { type: "info" });
        },
        onError: () => notify("Could not update payment", { type: "error" }),
      },
    );
  };

  const deleteRow = (payment: DealClientPayment) => {
    removeOne(
      "deal_client_payments",
      { id: payment.id, previousData: payment },
      {
        onSuccess: () => {
          refresh();
          notify(`Payment #${payment.id} deleted`, { type: "info" });
        },
        onError: () => notify("Could not delete payment", { type: "error" }),
      },
    );
  };

  if (isPending) return <EmptyDealTab label="Loading payments..." />;
  return (
    <div className="space-y-4">
      <InlineFormCard title="Add Payment">
        <div className="grid gap-2 md:grid-cols-2">
          <Input
            type="date"
            value={form.payment_date}
            onChange={(event) => setForm((prev) => ({ ...prev, payment_date: event.target.value }))}
          />
          <Input
            type="number"
            min={0}
            step="0.01"
            placeholder="Amount"
            value={form.amount}
            onChange={(event) => setForm((prev) => ({ ...prev, amount: event.target.value }))}
          />
          <select
            className="h-9 rounded-md border bg-background px-3 text-sm"
            value={form.payment_method}
            onChange={(event) =>
              setForm((prev) => ({ ...prev, payment_method: event.target.value }))
            }
          >
            <option value="check">Check</option>
            <option value="cash">Cash</option>
            <option value="zelle">Zelle</option>
            <option value="ach">ACH</option>
            <option value="card">Card</option>
            <option value="other">Other</option>
          </select>
          <select
            className="h-9 rounded-md border bg-background px-3 text-sm"
            value={form.status}
            onChange={(event) => setForm((prev) => ({ ...prev, status: event.target.value }))}
          >
            <option value="pending">Pending</option>
            <option value="cleared">Cleared</option>
            <option value="bounced">Bounced</option>
            <option value="deposited">Deposited</option>
          </select>
          <Input
            placeholder="Check number"
            value={form.check_number}
            onChange={(event) => setForm((prev) => ({ ...prev, check_number: event.target.value }))}
          />
          <Input
            placeholder="Reference number"
            value={form.reference_number}
            onChange={(event) =>
              setForm((prev) => ({ ...prev, reference_number: event.target.value }))
            }
          />
          <Input
            type="file"
            multiple
            onChange={(event) => setFiles(Array.from(event.target.files ?? []))}
            className="md:col-span-2"
          />
          <Textarea
            placeholder="Notes"
            value={form.notes}
            onChange={(event) => setForm((prev) => ({ ...prev, notes: event.target.value }))}
            className="md:col-span-2"
          />
        </div>
        <div className="mt-3 flex justify-end">
          <Button type="button" size="sm" onClick={handleCreate} disabled={isCreating}>
            Add Payment
          </Button>
        </div>
      </InlineFormCard>

      <div className="text-sm text-muted-foreground">
        Total collected: <strong className="text-foreground">{toCurrency(totalCollected)}</strong>
        {" · "}
        Pending: <strong className="text-foreground">{toCurrency(totalPending)}</strong>
        {" · "}
        Bounced: <strong className="text-foreground">{toCurrency(totalBounced)}</strong>
      </div>

      {payments.length === 0 ? (
        <EmptyDealTab label="No payments tied to this project yet." />
      ) : (
        <div className="overflow-x-auto rounded-md border">
          <table className="min-w-full text-sm">
            <thead className="bg-muted/40">
              <tr>
                <th className="px-3 py-2 text-left font-medium">Payment date</th>
                <th className="px-3 py-2 text-left font-medium">Amount</th>
                <th className="px-3 py-2 text-left font-medium">Method</th>
                <th className="px-3 py-2 text-left font-medium">Check / Reference</th>
                <th className="px-3 py-2 text-left font-medium">Status</th>
                <th className="px-3 py-2 text-left font-medium">Notes</th>
                <th className="px-3 py-2 text-left font-medium">Attachments</th>
                <th className="px-3 py-2 text-right font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {payments.map((payment) => (
                <tr key={payment.id} className="border-t">
                  <td className="px-3 py-2">
                    {editingId === Number(payment.id) ? (
                      <Input
                        type="date"
                        className={cn(editErrors.payment_date ? "border-red-500" : "")}
                        value={editRow?.payment_date ?? ""}
                        onChange={(event) =>
                          setEditRow((prev) =>
                            prev ? { ...prev, payment_date: event.target.value } : prev,
                          )
                        }
                      />
                    ) : (
                      toDateLabel(payment.payment_date)
                    )}
                  </td>
                  <td className="px-3 py-2">
                    {editingId === Number(payment.id) ? (
                      <Input
                        type="number"
                        min={0}
                        step="0.01"
                        className={cn(editErrors.amount ? "border-red-500" : "")}
                        value={editRow?.amount ?? ""}
                        onChange={(event) =>
                          setEditRow((prev) => (prev ? { ...prev, amount: event.target.value } : prev))
                        }
                      />
                    ) : (
                      toCurrency(Number(payment.amount ?? 0))
                    )}
                  </td>
                  <td className="px-3 py-2">
                    {editingId === Number(payment.id) ? (
                      <select
                        className="h-8 rounded-md border bg-background px-2 text-xs"
                        value={editRow?.payment_method ?? "check"}
                        onChange={(event) =>
                          setEditRow((prev) =>
                            prev ? { ...prev, payment_method: event.target.value } : prev,
                          )
                        }
                      >
                        <option value="check">Check</option>
                        <option value="cash">Cash</option>
                        <option value="zelle">Zelle</option>
                        <option value="ach">ACH</option>
                        <option value="card">Card</option>
                        <option value="other">Other</option>
                      </select>
                    ) : (
                      payment.payment_method
                    )}
                  </td>
                  <td className="px-3 py-2">
                    {editingId === Number(payment.id) ? (
                      <div className="grid gap-1">
                        <Input
                          value={editRow?.check_number ?? ""}
                          placeholder="Check"
                          onChange={(event) =>
                            setEditRow((prev) =>
                              prev ? { ...prev, check_number: event.target.value } : prev,
                            )
                          }
                        />
                        <Input
                          value={editRow?.reference_number ?? ""}
                          placeholder="Reference"
                          onChange={(event) =>
                            setEditRow((prev) =>
                              prev ? { ...prev, reference_number: event.target.value } : prev,
                            )
                          }
                        />
                      </div>
                    ) : (
                      payment.check_number || payment.reference_number || "—"
                    )}
                  </td>
                  <td className="px-3 py-2">
                    {editingId === Number(payment.id) ? (
                      <select
                        className={cn(
                          "h-8 rounded-md border bg-background px-2 text-xs",
                          editErrors.status ? "border-red-500" : "",
                        )}
                        value={editRow?.status ?? "pending"}
                        onChange={(event) =>
                          setEditRow((prev) => (prev ? { ...prev, status: event.target.value } : prev))
                        }
                      >
                        <option value="pending">Pending</option>
                        <option value="cleared">Cleared</option>
                        <option value="bounced">Bounced</option>
                        <option value="deposited">Deposited</option>
                      </select>
                    ) : (
                      payment.status
                    )}
                  </td>
                  <td className="px-3 py-2">
                    {editingId === Number(payment.id) ? (
                      <ExpandableTextCellEditor
                        value={editRow?.notes ?? ""}
                        placeholder="Notes"
                        onChange={(next) =>
                          setEditRow((prev) => (prev ? { ...prev, notes: next } : prev))
                        }
                      />
                    ) : (
                      <TextPreview value={payment.notes} />
                    )}
                  </td>
                  <td className="px-3 py-2">{payment.attachments?.length ?? 0}</td>
                  <td className="px-3 py-2">
                    <div className="flex items-center justify-end gap-1">
                      {editingId === Number(payment.id) ? (
                        <>
                          <Button
                            type="button"
                            size="icon"
                            variant="ghost"
                            className="h-7 w-7"
                            disabled={isUpdating}
                            onClick={() => saveEdit(payment)}
                          >
                            <Check className="h-4 w-4" />
                          </Button>
                          <Button
                            type="button"
                            size="icon"
                            variant="ghost"
                            className="h-7 w-7"
                            onClick={() => {
                              setEditingId(null);
                              setEditRow(null);
                              setEditErrors({});
                            }}
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </>
                      ) : (
                        <>
                          <Button
                            type="button"
                            size="icon"
                            variant="ghost"
                            className="h-7 w-7"
                            onClick={() => startEdit(payment)}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            type="button"
                            size="icon"
                            variant="ghost"
                            className="h-7 w-7 text-red-600"
                            disabled={isDeleting}
                            onClick={() => deleteRow(payment)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                          {Object.values(editErrors).length > 0 ? (
                            <div className="px-2 text-[11px] text-red-600">
                              {Object.values(editErrors)[0]}
                            </div>
                          ) : null}
                        </>
                      )}
                    </div>
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

const DealChangeOrdersTab = ({ dealId }: { dealId: Deal["id"] }) => {
  const [create, { isPending: isCreating }] = useCreate();
  const [update, { isPending: isUpdating }] = useUpdate();
  const [removeOne, { isPending: isDeleting }] = useDelete();
  const notify = useNotify();
  const refresh = useRefresh();
  const [files, setFiles] = useState<File[]>([]);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editErrors, setEditErrors] = useState<Record<string, string>>({});
  const [editRow, setEditRow] = useState<{
    title: string;
    description: string;
    change_date: string;
    amount: string;
    status: string;
    reason: string;
  } | null>(null);
  const [form, setForm] = useState({
    title: "",
    description: "",
    change_date: "",
    amount: "",
    reason: "",
    status: "draft",
  });
  const { data: changeOrders = [], isPending } = useGetList<DealChangeOrder>(
    "deal_change_orders",
    {
      filter: { "deal_id@eq": dealId },
      pagination: { page: 1, perPage: 500 },
      sort: { field: "change_date", order: "DESC" },
    },
    { staleTime: 30_000 },
  );
  const approvedTotal = useMemo(
    () =>
      changeOrders
        .filter((entry) => entry.status === "approved")
        .reduce((sum, entry) => sum + Number(entry.amount ?? 0), 0),
    [changeOrders],
  );
  const pendingTotal = useMemo(
    () =>
      changeOrders
        .filter((entry) => entry.status === "draft" || entry.status === "sent")
        .reduce((sum, entry) => sum + Number(entry.amount ?? 0), 0),
    [changeOrders],
  );
  const rejectedTotal = useMemo(
    () =>
      changeOrders
        .filter((entry) => entry.status === "rejected")
        .reduce((sum, entry) => sum + Number(entry.amount ?? 0), 0),
    [changeOrders],
  );

  const handleCreate = () => {
    const amount = Number(form.amount);
    if (!form.title.trim()) {
      notify("Enter change order title", { type: "error" });
      return;
    }
    if (!Number.isFinite(amount)) {
      notify("Enter valid amount", { type: "error" });
      return;
    }
    create(
      "deal_change_orders",
      {
        data: {
          deal_id: dealId,
          title: form.title.trim(),
          description: form.description || null,
          change_date: form.change_date || new Date().toISOString().slice(0, 10),
          amount,
          reason: form.reason || null,
          status: form.status,
          attachments: files.map((file) => ({
            rawFile: file,
            src: URL.createObjectURL(file),
            title: file.name,
            type: file.type,
          })),
        },
      },
      {
        onSuccess: () => {
          setForm({
            title: "",
            description: "",
            change_date: "",
            amount: "",
            reason: "",
            status: "draft",
          });
          setFiles([]);
          refresh();
          notify("Change order added", { type: "info" });
        },
        onError: () => notify("Could not add change order", { type: "error" }),
      },
    );
  };

  const startEdit = (entry: DealChangeOrder) => {
    setEditingId(Number(entry.id));
    setEditErrors({});
    setEditRow({
      title: entry.title,
      description: entry.description || "",
      change_date: entry.change_date || "",
      amount: String(entry.amount ?? 0),
      status: entry.status,
      reason: entry.reason || "",
    });
  };

  const saveEdit = (entry: DealChangeOrder) => {
    if (!editRow) return;
    const amount = Number(editRow.amount);
    const errors: Record<string, string> = {};
    if (!editRow.title.trim()) {
      errors.title = "Title is required";
    }
    if (!Number.isFinite(amount)) {
      errors.amount = "Amount is invalid";
    }
    if (!editRow.status) {
      errors.status = "Status is required";
    }
    if (Object.keys(errors).length > 0) {
      setEditErrors(errors);
      return;
    }
    setEditErrors({});
    update(
      "deal_change_orders",
      {
        id: entry.id,
        data: {
          title: editRow.title.trim(),
          description: editRow.description || null,
          change_date: editRow.change_date || new Date().toISOString().slice(0, 10),
          amount,
          status: editRow.status,
          reason: editRow.reason || null,
        },
        previousData: entry,
      },
      {
        onSuccess: () => {
          setEditingId(null);
          setEditRow(null);
          setEditErrors({});
          refresh();
          notify(`Change order #${entry.id} updated`, { type: "info" });
        },
        onError: () => notify("Could not update change order", { type: "error" }),
      },
    );
  };

  const deleteRow = (entry: DealChangeOrder) => {
    removeOne(
      "deal_change_orders",
      { id: entry.id, previousData: entry },
      {
        onSuccess: () => {
          refresh();
          notify(`Change order #${entry.id} deleted`, { type: "info" });
        },
        onError: () => notify("Could not delete change order", { type: "error" }),
      },
    );
  };

  if (isPending) return <EmptyDealTab label="Loading change orders..." />;
  return (
    <div className="space-y-4">
      <InlineFormCard title="Add Change Order">
        <div className="grid gap-2 md:grid-cols-2">
          <Input
            placeholder="Change order title"
            value={form.title}
            onChange={(event) => setForm((prev) => ({ ...prev, title: event.target.value }))}
            className="md:col-span-2"
          />
          <Textarea
            placeholder="Description"
            value={form.description}
            onChange={(event) =>
              setForm((prev) => ({ ...prev, description: event.target.value }))
            }
            className="md:col-span-2"
          />
          <Input
            type="date"
            value={form.change_date}
            onChange={(event) =>
              setForm((prev) => ({ ...prev, change_date: event.target.value }))
            }
          />
          <Input
            type="number"
            step="0.01"
            placeholder="Amount (+/-)"
            value={form.amount}
            onChange={(event) => setForm((prev) => ({ ...prev, amount: event.target.value }))}
          />
          <Input
            placeholder="Reason"
            value={form.reason}
            onChange={(event) => setForm((prev) => ({ ...prev, reason: event.target.value }))}
          />
          <select
            className="h-9 rounded-md border bg-background px-3 text-sm"
            value={form.status}
            onChange={(event) => setForm((prev) => ({ ...prev, status: event.target.value }))}
          >
            <option value="draft">Draft</option>
            <option value="sent">Sent</option>
            <option value="approved">Approved</option>
            <option value="rejected">Rejected</option>
          </select>
          <Input
            type="file"
            multiple
            onChange={(event) => setFiles(Array.from(event.target.files ?? []))}
            className="md:col-span-2"
          />
        </div>
        <div className="mt-3 flex justify-end">
          <Button type="button" size="sm" onClick={handleCreate} disabled={isCreating}>
            Add Change Order
          </Button>
        </div>
      </InlineFormCard>

      <div className="text-sm text-muted-foreground">
        Approved total: <strong className="text-foreground">{toCurrency(approvedTotal)}</strong>
        {" · "}
        Pending total: <strong className="text-foreground">{toCurrency(pendingTotal)}</strong>
        {" · "}
        Rejected total: <strong className="text-foreground">{toCurrency(rejectedTotal)}</strong>
      </div>

      {changeOrders.length === 0 ? (
        <EmptyDealTab label="No change orders linked to this project yet." />
      ) : (
        <div className="overflow-x-auto rounded-md border">
          <table className="min-w-full text-sm">
            <thead className="bg-muted/40">
              <tr>
                <th className="px-3 py-2 text-left font-medium">Title</th>
                <th className="px-3 py-2 text-left font-medium">Date</th>
                <th className="px-3 py-2 text-left font-medium">Amount</th>
                <th className="px-3 py-2 text-left font-medium">Status</th>
                <th className="px-3 py-2 text-left font-medium">Description</th>
                <th className="px-3 py-2 text-left font-medium">Reason</th>
                <th className="px-3 py-2 text-left font-medium">Attachments</th>
                <th className="px-3 py-2 text-right font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {changeOrders.map((entry) => (
                <tr key={entry.id} className="border-t">
                  <td className="px-3 py-2">
                    {editingId === Number(entry.id) ? (
                      <Input
                        className={cn(editErrors.title ? "border-red-500" : "")}
                        value={editRow?.title ?? ""}
                        onChange={(event) =>
                          setEditRow((prev) => (prev ? { ...prev, title: event.target.value } : prev))
                        }
                      />
                    ) : (
                      entry.title
                    )}
                  </td>
                  <td className="px-3 py-2">
                    {editingId === Number(entry.id) ? (
                      <Input
                        type="date"
                        value={editRow?.change_date ?? ""}
                        onChange={(event) =>
                          setEditRow((prev) =>
                            prev ? { ...prev, change_date: event.target.value } : prev,
                          )
                        }
                      />
                    ) : (
                      toDateLabel(entry.change_date)
                    )}
                  </td>
                  <td className="px-3 py-2">
                    {editingId === Number(entry.id) ? (
                      <Input
                        type="number"
                        step="0.01"
                        className={cn(editErrors.amount ? "border-red-500" : "")}
                        value={editRow?.amount ?? ""}
                        onChange={(event) =>
                          setEditRow((prev) => (prev ? { ...prev, amount: event.target.value } : prev))
                        }
                      />
                    ) : (
                      toCurrency(Number(entry.amount ?? 0))
                    )}
                  </td>
                  <td className="px-3 py-2">
                    {editingId === Number(entry.id) ? (
                      <select
                        className={cn(
                          "h-8 rounded-md border bg-background px-2 text-xs",
                          editErrors.status ? "border-red-500" : "",
                        )}
                        value={editRow?.status ?? "draft"}
                        onChange={(event) =>
                          setEditRow((prev) => (prev ? { ...prev, status: event.target.value } : prev))
                        }
                      >
                        <option value="draft">Draft</option>
                        <option value="sent">Sent</option>
                        <option value="approved">Approved</option>
                        <option value="rejected">Rejected</option>
                      </select>
                    ) : (
                      entry.status
                    )}
                  </td>
                  <td className="px-3 py-2">
                    {editingId === Number(entry.id) ? (
                      <ExpandableTextCellEditor
                        value={editRow?.description ?? ""}
                        placeholder="Description"
                        onChange={(next) =>
                          setEditRow((prev) => (prev ? { ...prev, description: next } : prev))
                        }
                      />
                    ) : (
                      <TextPreview value={entry.description} />
                    )}
                  </td>
                  <td className="px-3 py-2">
                    {editingId === Number(entry.id) ? (
                      <ExpandableTextCellEditor
                        value={editRow?.reason ?? ""}
                        placeholder="Reason"
                        onChange={(next) =>
                          setEditRow((prev) => (prev ? { ...prev, reason: next } : prev))
                        }
                      />
                    ) : (
                      <TextPreview value={entry.reason} />
                    )}
                  </td>
                  <td className="px-3 py-2">{entry.attachments?.length ?? 0}</td>
                  <td className="px-3 py-2">
                    <div className="flex items-center justify-end gap-1">
                      {editingId === Number(entry.id) ? (
                        <>
                          <Button
                            type="button"
                            size="icon"
                            variant="ghost"
                            className="h-7 w-7"
                            disabled={isUpdating}
                            onClick={() => saveEdit(entry)}
                          >
                            <Check className="h-4 w-4" />
                          </Button>
                          <Button
                            type="button"
                            size="icon"
                            variant="ghost"
                            className="h-7 w-7"
                            onClick={() => {
                              setEditingId(null);
                              setEditRow(null);
                              setEditErrors({});
                            }}
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </>
                      ) : (
                        <>
                          <Button
                            type="button"
                            size="icon"
                            variant="ghost"
                            className="h-7 w-7"
                            onClick={() => startEdit(entry)}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            type="button"
                            size="icon"
                            variant="ghost"
                            className="h-7 w-7 text-red-600"
                            disabled={isDeleting}
                            onClick={() => deleteRow(entry)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                          {Object.values(editErrors).length > 0 ? (
                            <div className="px-2 text-[11px] text-red-600">
                              {Object.values(editErrors)[0]}
                            </div>
                          ) : null}
                        </>
                      )}
                    </div>
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

const DealCommissionsTab = ({ dealId }: { dealId: Deal["id"] }) => {
  const [create, { isPending: isCreating }] = useCreate();
  const [update, { isPending: isUpdating }] = useUpdate();
  const [removeOne, { isPending: isDeleting }] = useDelete();
  const notify = useNotify();
  const refresh = useRefresh();
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editErrors, setEditErrors] = useState<Record<string, string>>({});
  const [editRow, setEditRow] = useState<{
    salesperson_id: string;
    commission_type: string;
    commission_value: string;
    basis: string;
    paid: boolean;
    notes: string;
  } | null>(null);
  const [form, setForm] = useState({
    salesperson_id: "",
    commission_type: "percentage",
    commission_value: "",
    basis: "payments_collected",
    paid: false,
    notes: "",
  });
  const { data: commissions = [], isPending } = useGetList<DealCommission>(
    "deal_commissions",
    {
      filter: { "deal_id@eq": dealId },
      pagination: { page: 1, perPage: 500 },
      sort: { field: "created_at", order: "DESC" },
    },
    { staleTime: 30_000 },
  );
  const { data: salespeople = [] } = useGetList<Person>(
    "people",
    {
      filter: { "type@eq": "salesperson" },
      pagination: { page: 1, perPage: 500 },
      sort: { field: "last_name", order: "ASC" },
    },
    { staleTime: 30_000 },
  );
  const salespersonById = useMemo(
    () => Object.fromEntries(salespeople.map((person) => [Number(person.id), person])),
    [salespeople],
  );
  const { data: payments = [] } = useGetList<DealClientPayment>(
    "deal_client_payments",
    {
      filter: { "deal_id@eq": dealId },
      pagination: { page: 1, perPage: 500 },
      sort: { field: "payment_date", order: "DESC" },
    },
    { staleTime: 30_000 },
  );
  const collectedAmount = useMemo(
    () =>
      payments
        .filter((payment) => payment.status === "cleared" || payment.status === "deposited")
        .reduce((sum, payment) => sum + Number(payment.amount ?? 0), 0),
    [payments],
  );
  const rows = useMemo(
    () =>
      commissions.map((commission) => {
        const value = Number(commission.commission_value ?? 0);
        const earned =
          commission.commission_type === "fixed"
            ? value
            : commission.basis === "payments_collected"
              ? collectedAmount * (value / 100)
              : 0;
        return { commission, earned };
      }),
    [commissions, collectedAmount],
  );
  const totalEarned = useMemo(
    () => rows.reduce((sum, row) => sum + row.earned, 0),
    [rows],
  );
  const totalPaid = useMemo(
    () => rows.filter((row) => row.commission.paid).reduce((sum, row) => sum + row.earned, 0),
    [rows],
  );

  const handleCreate = () => {
    const salespersonId = Number(form.salesperson_id);
    const value = Number(form.commission_value);
    if (!Number.isFinite(salespersonId) || salespersonId <= 0) {
      notify("Select salesperson", { type: "error" });
      return;
    }
    if (!Number.isFinite(value) || value < 0) {
      notify("Enter valid commission value", { type: "error" });
      return;
    }
    create(
      "deal_commissions",
      {
        data: {
          deal_id: dealId,
          salesperson_id: salespersonId,
          commission_type: form.commission_type,
          commission_value: value,
          basis: form.basis,
          paid: form.paid,
          notes: form.notes || null,
        },
      },
      {
        onSuccess: () => {
          setForm({
            salesperson_id: "",
            commission_type: "percentage",
            commission_value: "",
            basis: "payments_collected",
            paid: false,
            notes: "",
          });
          refresh();
          notify("Commission added", { type: "info" });
        },
        onError: () => notify("Could not add commission", { type: "error" }),
      },
    );
  };

  const startEdit = (commission: DealCommission) => {
    setEditingId(Number(commission.id));
    setEditErrors({});
    setEditRow({
      salesperson_id: String(commission.salesperson_id),
      commission_type: commission.commission_type,
      commission_value: String(commission.commission_value ?? 0),
      basis: commission.basis,
      paid: !!commission.paid,
      notes: commission.notes || "",
    });
  };

  const saveEdit = (commission: DealCommission) => {
    if (!editRow) return;
    const salespersonId = Number(editRow.salesperson_id);
    const value = Number(editRow.commission_value);
    const errors: Record<string, string> = {};
    if (!Number.isFinite(salespersonId) || salespersonId <= 0) {
      errors.salesperson_id = "Salesperson is required";
    }
    if (!Number.isFinite(value) || value < 0) {
      errors.commission_value = "Value must be 0 or greater";
    }
    if (Object.keys(errors).length > 0) {
      setEditErrors(errors);
      return;
    }
    setEditErrors({});
    update(
      "deal_commissions",
      {
        id: commission.id,
        data: {
          salesperson_id: salespersonId,
          commission_type: editRow.commission_type,
          commission_value: value,
          basis: editRow.basis,
          paid: editRow.paid,
          notes: editRow.notes || null,
        },
        previousData: commission,
      },
      {
        onSuccess: () => {
          setEditingId(null);
          setEditRow(null);
          setEditErrors({});
          refresh();
          notify(`Commission #${commission.id} updated`, { type: "info" });
        },
        onError: () => notify("Could not update commission", { type: "error" }),
      },
    );
  };

  const deleteRow = (commission: DealCommission) => {
    removeOne(
      "deal_commissions",
      { id: commission.id, previousData: commission },
      {
        onSuccess: () => {
          refresh();
          notify(`Commission #${commission.id} deleted`, { type: "info" });
        },
        onError: () => notify("Could not delete commission", { type: "error" }),
      },
    );
  };

  if (isPending) return <EmptyDealTab label="Loading commissions..." />;
  return (
    <div className="space-y-4">
      <InlineFormCard title="Add Commission">
        <div className="grid gap-2 md:grid-cols-2">
          <select
            className="h-9 rounded-md border bg-background px-3 text-sm"
            value={form.salesperson_id}
            onChange={(event) =>
              setForm((prev) => ({ ...prev, salesperson_id: event.target.value }))
            }
          >
            <option value="">Select salesperson</option>
            {salespeople.map((person) => (
              <option key={person.id} value={String(person.id)}>
                {person.first_name} {person.last_name}
              </option>
            ))}
          </select>
          <select
            className="h-9 rounded-md border bg-background px-3 text-sm"
            value={form.commission_type}
            onChange={(event) =>
              setForm((prev) => ({ ...prev, commission_type: event.target.value }))
            }
          >
            <option value="fixed">Fixed</option>
            <option value="percentage">Percentage</option>
          </select>
          <Input
            type="number"
            min={0}
            step="0.01"
            placeholder={form.commission_type === "percentage" ? "Percent value" : "Fixed value"}
            value={form.commission_value}
            onChange={(event) =>
              setForm((prev) => ({ ...prev, commission_value: event.target.value }))
            }
          />
          <select
            className="h-9 rounded-md border bg-background px-3 text-sm"
            value={form.basis}
            onChange={(event) => setForm((prev) => ({ ...prev, basis: event.target.value }))}
          >
            <option value="payments_collected">Payments collected</option>
            <option value="custom">Custom</option>
          </select>
          <label className="flex items-center gap-2 text-sm text-muted-foreground">
            <input
              type="checkbox"
              checked={form.paid}
              onChange={(event) => setForm((prev) => ({ ...prev, paid: event.target.checked }))}
            />
            Mark as paid
          </label>
          <Textarea
            placeholder="Notes"
            value={form.notes}
            onChange={(event) => setForm((prev) => ({ ...prev, notes: event.target.value }))}
            className="md:col-span-2"
          />
        </div>
        <div className="mt-3 flex justify-end">
          <Button type="button" size="sm" onClick={handleCreate} disabled={isCreating}>
            Add Commission
          </Button>
        </div>
      </InlineFormCard>

      <div className="text-sm text-muted-foreground">
        Total commissions earned: <strong className="text-foreground">{toCurrency(totalEarned)}</strong>
        {" · "}
        Paid: <strong className="text-foreground">{toCurrency(totalPaid)}</strong>
        {" · "}
        Pending: <strong className="text-foreground">{toCurrency(totalEarned - totalPaid)}</strong>
      </div>

      {rows.length === 0 ? (
        <EmptyDealTab label="No commissions tied to this project yet." />
      ) : (
        <div className="overflow-x-auto rounded-md border">
          <table className="min-w-full text-sm">
            <thead className="bg-muted/40">
              <tr>
                <th className="px-3 py-2 text-left font-medium">Salesperson</th>
                <th className="px-3 py-2 text-left font-medium">Type</th>
                <th className="px-3 py-2 text-left font-medium">Value</th>
                <th className="px-3 py-2 text-left font-medium">Basis</th>
                <th className="px-3 py-2 text-left font-medium">Earned</th>
                <th className="px-3 py-2 text-left font-medium">Paid</th>
                <th className="px-3 py-2 text-left font-medium">Notes</th>
                <th className="px-3 py-2 text-right font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(({ commission, earned }) => (
                <tr key={commission.id} className="border-t">
                  <td className="px-3 py-2">
                    {editingId === Number(commission.id) ? (
                      <select
                        className={cn(
                          "h-8 rounded-md border bg-background px-2 text-xs",
                          editErrors.salesperson_id ? "border-red-500" : "",
                        )}
                        value={editRow?.salesperson_id ?? ""}
                        onChange={(event) =>
                          setEditRow((prev) =>
                            prev ? { ...prev, salesperson_id: event.target.value } : prev,
                          )
                        }
                      >
                        <option value="">Select salesperson</option>
                        {salespeople.map((person) => (
                          <option key={person.id} value={String(person.id)}>
                            {person.first_name} {person.last_name}
                          </option>
                        ))}
                      </select>
                    ) : (
                      `${salespersonById[Number(commission.salesperson_id)]?.first_name || ""} ${
                        salespersonById[Number(commission.salesperson_id)]?.last_name || ""
                      }`.trim() || "—"
                    )}
                  </td>
                  <td className="px-3 py-2">
                    {editingId === Number(commission.id) ? (
                      <select
                        className="h-8 rounded-md border bg-background px-2 text-xs"
                        value={editRow?.commission_type ?? "percentage"}
                        onChange={(event) =>
                          setEditRow((prev) =>
                            prev ? { ...prev, commission_type: event.target.value } : prev,
                          )
                        }
                      >
                        <option value="fixed">Fixed</option>
                        <option value="percentage">Percentage</option>
                      </select>
                    ) : (
                      commission.commission_type
                    )}
                  </td>
                  <td className="px-3 py-2">
                    {editingId === Number(commission.id) ? (
                      <Input
                        type="number"
                        min={0}
                        step="0.01"
                        className={cn(editErrors.commission_value ? "border-red-500" : "")}
                        value={editRow?.commission_value ?? ""}
                        onChange={(event) =>
                          setEditRow((prev) =>
                            prev ? { ...prev, commission_value: event.target.value } : prev,
                          )
                        }
                      />
                    ) : commission.commission_type === "percentage" ? (
                      `${Number(commission.commission_value ?? 0).toFixed(2)}%`
                    ) : (
                      toCurrency(Number(commission.commission_value ?? 0))
                    )}
                  </td>
                  <td className="px-3 py-2">
                    {editingId === Number(commission.id) ? (
                      <select
                        className="h-8 rounded-md border bg-background px-2 text-xs"
                        value={editRow?.basis ?? "payments_collected"}
                        onChange={(event) =>
                          setEditRow((prev) => (prev ? { ...prev, basis: event.target.value } : prev))
                        }
                      >
                        <option value="payments_collected">Payments collected</option>
                        <option value="custom">Custom</option>
                      </select>
                    ) : (
                      commission.basis
                    )}
                  </td>
                  <td className="px-3 py-2">{toCurrency(earned)}</td>
                  <td className="px-3 py-2">
                    {editingId === Number(commission.id) ? (
                      <label className="flex items-center gap-2 text-xs text-muted-foreground">
                        <input
                          type="checkbox"
                          checked={!!editRow?.paid}
                          onChange={(event) =>
                            setEditRow((prev) => (prev ? { ...prev, paid: event.target.checked } : prev))
                          }
                        />
                        paid
                      </label>
                    ) : commission.paid ? (
                      "Paid"
                    ) : (
                      "Pending"
                    )}
                  </td>
                  <td className="px-3 py-2">
                    {editingId === Number(commission.id) ? (
                      <ExpandableTextCellEditor
                        value={editRow?.notes ?? ""}
                        placeholder="Notes"
                        onChange={(next) =>
                          setEditRow((prev) => (prev ? { ...prev, notes: next } : prev))
                        }
                      />
                    ) : (
                      <TextPreview value={commission.notes} />
                    )}
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex items-center justify-end gap-1">
                      {editingId === Number(commission.id) ? (
                        <>
                          <Button
                            type="button"
                            size="icon"
                            variant="ghost"
                            className="h-7 w-7"
                            disabled={isUpdating}
                            onClick={() => saveEdit(commission)}
                          >
                            <Check className="h-4 w-4" />
                          </Button>
                          <Button
                            type="button"
                            size="icon"
                            variant="ghost"
                            className="h-7 w-7"
                            onClick={() => {
                              setEditingId(null);
                              setEditRow(null);
                              setEditErrors({});
                            }}
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </>
                      ) : (
                        <>
                          <Button
                            type="button"
                            size="icon"
                            variant="ghost"
                            className="h-7 w-7"
                            onClick={() => startEdit(commission)}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            type="button"
                            size="icon"
                            variant="ghost"
                            className="h-7 w-7 text-red-600"
                            disabled={isDeleting}
                            onClick={() => deleteRow(commission)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                          {Object.values(editErrors).length > 0 ? (
                            <div className="px-2 text-[11px] text-red-600">
                              {Object.values(editErrors)[0]}
                            </div>
                          ) : null}
                        </>
                      )}
                    </div>
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

const DealFilesTab = ({
  dealId,
  kind,
  files,
  links,
  groupedSources,
  emptyLabel,
}: {
  dealId: Deal["id"];
  kind: "documents" | "photos";
  files: DealAttachmentEntry[];
  links: ParsedAssetLink[];
  groupedSources?: {
    payments: RAFile[];
    subcontractors: RAFile[];
    expenses: RAFile[];
    changeOrders: RAFile[];
  };
  emptyLabel: string;
}) => {
  const { identity } = useGetIdentity();
  const [create, { isPending: isCreatingLink }] = useCreate();
  const [updateNote] = useUpdate();
  const [deleteOne] = useDelete();
  const notify = useNotify();
  const refresh = useRefresh();
  const [url, setUrl] = useState("");
  const [title, setTitle] = useState("");
  const [note, setNote] = useState("");
  const [pendingUploads, setPendingUploads] = useState<PendingUploadEntry[]>([]);
  const [isDragOverUpload, setIsDragOverUpload] = useState(false);
  const [isUploadingDocs, setIsUploadingDocs] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);

  useEffect(() => {
    if (!isUploadingDocs) return;
    const timer = window.setInterval(() => {
      setUploadProgress((current) => {
        if (current >= 90) return current;
        return current + Math.max(1, Math.round((95 - current) / 8));
      });
    }, 180);
    return () => window.clearInterval(timer);
  }, [isUploadingDocs]);

  const groupedDocFiles = groupedSources
    ? [
        { key: "payments", label: "Payments", files: groupedSources.payments },
        { key: "subcontractors", label: "Subcontractors", files: groupedSources.subcontractors },
        { key: "expenses", label: "Expenses", files: groupedSources.expenses },
        { key: "change-orders", label: "Change Orders", files: groupedSources.changeOrders },
      ].filter((group) => group.files.length > 0)
    : [];
  const hasItems = files.length > 0 || links.length > 0 || groupedDocFiles.length > 0;

  const handleCreateLink = () => {
    if (!identity?.id) {
      notify("You must be logged in to add links", { type: "error" });
      return;
    }
    const trimmedUrl = url.trim();
    if (!trimmedUrl) {
      notify("Please enter a URL", { type: "error" });
      return;
    }
    try {
      const parsed = new URL(trimmedUrl);
      if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
        throw new Error("Unsupported protocol");
      }
    } catch {
      notify("Please enter a valid URL (http/https)", { type: "error" });
      return;
    }

    create(
      "deal_notes",
      {
        data: {
          deal_id: dealId,
          sales_id: identity.id,
          date: new Date().toISOString(),
          text: serializeAssetLink({
            kind,
            url: trimmedUrl,
            title: title.trim() || undefined,
            note: note.trim() || undefined,
          }),
          attachments: [],
        },
      },
      {
        onSuccess: () => {
          setUrl("");
          setTitle("");
          setNote("");
          refresh();
          notify("Link added", { type: "info" });
        },
        onError: () => {
          notify("Could not add link", { type: "error" });
        },
      },
    );
  };

  const handleUploadFiles = (
    filesToUpload: File[],
    queuedUploads: PendingUploadEntry[],
  ) => {
    if (!identity?.id) {
      notify("You must be logged in to upload files", { type: "error" });
      return;
    }
    if (filesToUpload.length === 0) {
      notify("Please select at least one file", { type: "error" });
      return;
    }

    const attachments: RAFile[] = filesToUpload.map((file) => ({
      rawFile: file,
      src: URL.createObjectURL(file),
      title: file.name,
      type: file.type,
    }));

    create(
      "deal_notes",
      {
        data: {
          deal_id: dealId,
          sales_id: identity.id,
          date: new Date().toISOString(),
          text: "",
          attachments,
        },
      },
      {
        onSuccess: () => {
          setUploadProgress(100);
          setIsUploadingDocs(false);
          queuedUploads.forEach((entry) => {
            if (entry.previewUrl) URL.revokeObjectURL(entry.previewUrl);
          });
          setPendingUploads([]);
          refresh();
          notify("Files uploaded", { type: "info" });
          window.setTimeout(() => setUploadProgress(0), 500);
        },
        onError: () => {
          setIsUploadingDocs(false);
          setUploadProgress(0);
          queuedUploads.forEach((entry) => {
            if (entry.previewUrl) URL.revokeObjectURL(entry.previewUrl);
          });
          setPendingUploads([]);
          notify("Could not upload files", { type: "error" });
        },
      },
    );
  };

  const queueAndUploadFiles = (nextFiles: File[]) => {
    if (nextFiles.length === 0) return;
    const allowedFiles = nextFiles.filter(isAllowedDocumentFile);
    const rejectedCount = nextFiles.length - allowedFiles.length;
    if (rejectedCount > 0) {
      notify("Only document files are allowed (PDF, Word, Excel, CSV, TXT)", {
        type: "warning",
      });
    }
    if (allowedFiles.length === 0) return;

    const queued = allowedFiles.map((file, index) => ({
      id: `${Date.now()}-${index}-${file.name}`,
      file,
      previewUrl: file.type.startsWith("image/") ? URL.createObjectURL(file) : "",
    }));
    setPendingUploads(queued);
    setIsUploadingDocs(true);
    setUploadProgress(8);
    handleUploadFiles(allowedFiles, queued);
  };

  const handleDeleteLink = (link: ParsedAssetLink) => {
    if (!link.noteId) {
      notify("This link cannot be deleted", { type: "error" });
      return;
    }
    deleteOne(
      "deal_notes",
      { id: link.noteId, previousData: { id: link.noteId } },
      {
        onSuccess: () => {
          refresh();
          notify("Link deleted", { type: "info" });
        },
        onError: () => notify("Could not delete link", { type: "error" }),
      },
    );
  };

  const handleDeleteFile = (entry: DealAttachmentEntry) => {
    const nextAttachments = entry.noteAttachments.filter(
      (_, index) => index !== entry.attachmentIndex,
    );

    updateNote(
      "deal_notes",
      {
        id: entry.noteId,
        data: { attachments: nextAttachments },
        previousData: { id: entry.noteId },
      },
      {
        onSuccess: () => {
          refresh();
          notify("File deleted", { type: "info" });
        },
        onError: () => notify("Could not delete file", { type: "error" }),
      },
    );
  };

  const handleEditFileTitle = (entry: DealAttachmentEntry, fallbackTitle: string) => {
    const currentTitle = entry.file.title || fallbackTitle;
    const nextTitle = window.prompt("Edit file title", currentTitle);
    if (nextTitle == null) return;
    const trimmedTitle = nextTitle.trim();
    if (!trimmedTitle) {
      notify("Title cannot be empty", { type: "error" });
      return;
    }

    const nextAttachments = entry.noteAttachments.map((attachment, index) =>
      index === entry.attachmentIndex
        ? { ...attachment, title: trimmedTitle }
        : attachment,
    );

    updateNote(
      "deal_notes",
      {
        id: entry.noteId,
        data: { attachments: nextAttachments },
        previousData: { id: entry.noteId },
      },
      {
        onSuccess: () => {
          refresh();
          notify("File title updated", { type: "info" });
        },
        onError: () => notify("Could not update file title", { type: "error" }),
      },
    );
  };

  const openInBrowser = (src: string) => {
    window.open(src, "_blank", "noopener,noreferrer");
  };

  const downloadFile = (src: string, title?: string) => {
    const a = document.createElement("a");
    a.href = src;
    a.target = "_blank";
    a.rel = "noreferrer";
    a.download = title || "file";
    document.body.appendChild(a);
    a.click();
    a.remove();
  };

  const isImageFile = (src: string, type?: string) =>
    type?.startsWith("image/") ||
    src.toLowerCase().endsWith(".png") ||
    src.toLowerCase().endsWith(".jpg") ||
    src.toLowerCase().endsWith(".jpeg") ||
    src.toLowerCase().endsWith(".webp");

  const getFileExt = (src: string, title?: string) => {
    const candidate = (title || src).split("?")[0].split("#")[0];
    const parts = candidate.split(".");
    return parts.length > 1 ? parts.pop()?.toLowerCase() || "" : "";
  };

  const getFilePreviewMeta = (src: string, title?: string, type?: string) => {
    const ext = getFileExt(src, title);
    if (type === "application/pdf" || ext === "pdf") {
      return { label: "PDF", Icon: FileText };
    }
    if (
      type?.includes("spreadsheet") ||
      ["xls", "xlsx", "csv"].includes(ext)
    ) {
      return { label: "XLS", Icon: FileSpreadsheet };
    }
    if (type?.startsWith("audio/") || ["mp3", "wav", "m4a"].includes(ext)) {
      return { label: "AUDIO", Icon: FileAudio };
    }
    if (type?.startsWith("video/") || ["mp4", "mov", "avi"].includes(ext)) {
      return { label: "VIDEO", Icon: FileVideo };
    }
    if (["zip", "rar", "7z", "gz"].includes(ext)) {
      return { label: "ZIP", Icon: FileArchive };
    }
    if (["json", "xml", "md", "txt", "ts", "tsx", "js", "jsx"].includes(ext)) {
      return { label: "CODE", Icon: FileCode };
    }
    return { label: ext ? ext.toUpperCase() : "FILE", Icon: FileText };
  };

  const renderReadOnlyFileCard = (file: RAFile, key: string, fallbackTitle: string) => (
    <div
      key={key}
      className="group relative aspect-square cursor-pointer overflow-hidden rounded-md border bg-muted/20"
      onClick={() => openInBrowser(file.src)}
    >
      <div className="h-full w-full overflow-hidden bg-muted/30">
        {isImageFile(file.src, file.type) ? (
          <img
            src={file.src}
            alt={file.title || fallbackTitle}
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="flex h-full items-center justify-center text-muted-foreground">
            {(() => {
              const { Icon, label } = getFilePreviewMeta(file.src, file.title, file.type);
              return (
                <div className="flex flex-col items-center gap-1">
                  <Icon className="h-7 w-7" />
                  <span className="text-[10px] font-semibold">{label}</span>
                </div>
              );
            })()}
          </div>
        )}
      </div>
      <div className="pointer-events-none absolute inset-x-2 bottom-2 rounded-md bg-background/90 px-2 py-1 text-xs font-medium truncate">
        {file.title || fallbackTitle}
      </div>
      <div className="absolute right-1.5 top-1.5 hidden items-center gap-1 rounded-md bg-background/90 p-1 shadow-sm group-hover:flex">
        <Button
          type="button"
          size="icon"
          variant="ghost"
          className="h-7 w-7"
          onClick={(event) => {
            event.stopPropagation();
            openInBrowser(file.src);
          }}
        >
          <Eye className="h-4 w-4" />
        </Button>
        <Button
          type="button"
          size="icon"
          variant="ghost"
          className="h-7 w-7"
          onClick={(event) => {
            event.stopPropagation();
            downloadFile(file.src, file.title);
          }}
        >
          <Download className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );

  return (
    <div className="space-y-4">
      {kind === "photos" ? (
        <div className="rounded-md border p-3">
          <div className="mb-2 text-sm font-medium">Add external photo link</div>
          <div className="grid grid-cols-1 gap-2">
            <Input
              value={url}
              onChange={(event) => setUrl(event.target.value)}
              placeholder="https://companycam.com/... or any external URL"
            />
            <Input
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="Title (optional)"
            />
            <Textarea
              value={note}
              onChange={(event) => setNote(event.target.value)}
              placeholder="Note (optional)"
              className="min-h-20"
            />
            <div className="flex justify-end">
              <Button
                type="button"
                onClick={handleCreateLink}
                disabled={isCreatingLink}
                className="gap-2"
              >
                <Link2 className="h-4 w-4" />
                Add link
              </Button>
            </div>
          </div>
        </div>
      ) : null}

      {!hasItems && kind !== "documents" ? <EmptyDealTab label={emptyLabel} /> : null}

      {links.length > 0 ? (
        <div className="space-y-2">
          {links.map((link, index) => (
            <div
              key={`${link.url}-${link.noteId ?? index}`}
              className="group relative rounded-md border px-3 py-2 text-sm hover:bg-muted/40"
              onClick={() => openInBrowser(link.url)}
            >
              <div className="font-medium underline pr-20">
                {link.title || `External ${kind === "photos" ? "photo" : "document"} ${index + 1}`}
              </div>
              {link.note ? (
                <div className="mt-1 text-xs text-muted-foreground">{link.note}</div>
              ) : null}
              <div className="absolute right-2 top-2 hidden items-center gap-1 group-hover:flex">
                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  className="h-7 w-7"
                  onClick={(event) => {
                    event.stopPropagation();
                    openInBrowser(link.url);
                  }}
                >
                  <Eye className="h-4 w-4" />
                </Button>
                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  className="h-7 w-7"
                  onClick={(event) => {
                    event.stopPropagation();
                    downloadFile(link.url, link.title);
                  }}
                >
                  <Download className="h-4 w-4" />
                </Button>
                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  className="h-7 w-7"
                  onClick={(event) => {
                    event.stopPropagation();
                    handleDeleteLink(link);
                  }}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      ) : null}

      {kind === "documents" || files.length > 0 ? (
        <div className="space-y-3">
          {kind === "documents" ? (
            <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Documents
            </div>
          ) : null}
          <div className="grid grid-cols-[repeat(auto-fill,minmax(145px,1fr))] gap-3">
          {kind === "documents" ? (
            <div
              className={cn(
                "relative aspect-square overflow-hidden rounded-md border border-dashed bg-muted/20 transition-colors",
                isDragOverUpload ? "border-primary bg-primary/10" : "",
              )}
              onDragOver={(event) => {
                event.preventDefault();
                event.stopPropagation();
                if (!isDragOverUpload) setIsDragOverUpload(true);
              }}
              onDragLeave={(event) => {
                event.preventDefault();
                event.stopPropagation();
                setIsDragOverUpload(false);
              }}
              onDrop={(event) => {
                event.preventDefault();
                event.stopPropagation();
                setIsDragOverUpload(false);
                const nextFiles = Array.from(event.dataTransfer.files ?? []);
                if (nextFiles.length > 0) {
                  queueAndUploadFiles(nextFiles);
                }
              }}
            >
              <input
                type="file"
                multiple
                accept=".pdf,.doc,.docx,.xls,.xlsx,.csv,.txt,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/csv,text/plain"
                className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
                onChange={(event) => {
                  const nextFiles = Array.from(event.target.files ?? []);
                  queueAndUploadFiles(nextFiles);
                  event.currentTarget.value = "";
                }}
              />
              <div className="flex h-full w-full flex-col items-center justify-center gap-2 px-3 text-center">
                <UploadCloud className="h-6 w-6 text-muted-foreground" />
                <div className="text-xs text-muted-foreground">
                  Drop or click to upload
                </div>
                {isUploadingDocs || uploadProgress > 0 ? (
                  <div className="w-full px-2">
                    <Progress value={uploadProgress} className="h-1.5" />
                    <div className="mt-1 text-[10px] text-muted-foreground">
                      Uploading documents... {uploadProgress}%
                    </div>
                  </div>
                ) : null}
              </div>
            </div>
          ) : null}
          {pendingUploads.map((pending) => (
            <div
              key={`pending-${pending.id}`}
              className="relative aspect-square overflow-hidden rounded-md border bg-muted/10"
            >
              <div className="h-full w-full overflow-hidden bg-muted/30">
                {pending.previewUrl ? (
                  <img
                    src={pending.previewUrl}
                    alt={pending.file.name}
                    className="h-full w-full object-cover opacity-70"
                  />
                ) : (
                  <div className="flex h-full items-center justify-center text-muted-foreground">
                    {(() => {
                      const { Icon, label } = getFilePreviewMeta(
                        pending.file.name,
                        pending.file.name,
                        pending.file.type,
                      );
                      return (
                        <div className="flex flex-col items-center gap-1">
                          <Icon className="h-7 w-7" />
                          <span className="text-[10px] font-semibold">{label}</span>
                        </div>
                      );
                    })()}
                  </div>
                )}
              </div>
              <div className="absolute inset-x-2 bottom-2 rounded-md bg-background/90 px-2 py-1 text-xs font-medium truncate">
                {pending.file.name}
              </div>
              <div className="absolute inset-x-2 top-2">
                <Progress value={uploadProgress} className="h-1.5" />
              </div>
            </div>
          ))}
          {files.map((entry, index) => (
            <div
              key={`${entry.noteId}-${entry.attachmentIndex}-${entry.file.src}-${index}`}
              className="group relative aspect-square cursor-pointer overflow-hidden rounded-md border bg-muted/20"
              onClick={() => openInBrowser(entry.file.src)}
            >
              <div className="h-full w-full overflow-hidden bg-muted/30">
                {isImageFile(entry.file.src, entry.file.type) ? (
                  <img
                    src={entry.file.src}
                    alt={entry.file.title || `File ${index + 1}`}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <div className="flex h-full items-center justify-center text-muted-foreground">
                    {(() => {
                      const { Icon, label } = getFilePreviewMeta(
                        entry.file.src,
                        entry.file.title,
                        entry.file.type,
                      );
                      return (
                        <div className="flex flex-col items-center gap-1">
                          <Icon className="h-7 w-7" />
                          <span className="text-[10px] font-semibold">{label}</span>
                        </div>
                      );
                    })()}
                  </div>
                )}
              </div>
              <div className="pointer-events-none absolute inset-x-2 bottom-2 rounded-md bg-background/90 px-2 py-1 text-xs font-medium truncate">
                {entry.file.title || `File ${index + 1}`}
              </div>
              <div className="absolute right-1.5 top-1.5 hidden items-center gap-1 rounded-md bg-background/90 p-1 shadow-sm group-hover:flex">
                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  className="h-7 w-7"
                  onClick={(event) => {
                    event.stopPropagation();
                    openInBrowser(entry.file.src);
                  }}
                >
                  <Eye className="h-4 w-4" />
                </Button>
                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  className="h-7 w-7"
                  onClick={(event) => {
                    event.stopPropagation();
                    downloadFile(entry.file.src, entry.file.title);
                  }}
                >
                  <Download className="h-4 w-4" />
                </Button>
                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  className="h-7 w-7"
                  onClick={(event) => {
                    event.stopPropagation();
                    handleEditFileTitle(entry, `File ${index + 1}`);
                  }}
                >
                  <Pencil className="h-4 w-4" />
                </Button>
                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  className="h-7 w-7"
                  onClick={(event) => {
                    event.stopPropagation();
                    handleDeleteFile(entry);
                  }}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ))}
          </div>
        </div>
      ) : null}

      {kind === "documents" && groupedDocFiles.length > 0 ? (
        <div className="space-y-3">
          {groupedDocFiles.map((group) => (
            <div key={group.key} className="space-y-2">
              <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                {group.label}
              </div>
              <div className="grid grid-cols-[repeat(auto-fill,minmax(145px,1fr))] gap-3">
                {group.files.map((file, index) =>
                  renderReadOnlyFileCard(
                    file,
                    `${group.key}-${file.src}-${index}`,
                    `File ${index + 1}`,
                  ),
                )}
              </div>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
};

const DealNotesTab = () => (
  <DealNotesTabContent />
);

const DealNotesTabContent = () => {
  const record = useRecordContext<Deal>();
  const { data: notes = [], isPending } = useGetList<DealNote>(
    "deal_notes",
    {
      filter: { "deal_id@eq": record?.id },
      pagination: { page: 1, perPage: 200 },
      sort: { field: "date", order: "DESC" },
    },
    { enabled: !!record?.id, staleTime: 30_000 },
  );

  const filteredNotes = useMemo(
    () =>
      notes.filter((note) => {
        // Hide entries created by Documents/Photos tabs.
        if (extractAssetLinksFromDealNotes([note]).length > 0) return false;
        // Backward compatibility for previously stored document-only notes.
        if (!note.text?.trim() && (note.attachments?.length ?? 0) > 0) return false;
        return true;
      }),
    [notes],
  );

  if (isPending) return null;

  return (
    <div className="m-2">
      <Separator className="mb-4" />
      <NoteCreate reference="deals" />
      <div className="mt-4 space-y-4">
        {filteredNotes.map((note, index) => (
          <div key={note.id}>
            <Note note={note} isLast={index === filteredNotes.length - 1} />
            {index < filteredNotes.length - 1 ? <Separator /> : null}
          </div>
        ))}
      </div>
    </div>
  );
};

const getProjectCode = (record: Deal) => {
  const meta = (record.project_address_meta ?? {}) as Record<string, unknown>;
  const raw =
    meta.project_code ??
    meta.claim_number ??
    meta.claim_no ??
    meta.job_id ??
    meta.job_number ??
    meta.code ??
    null;
  const value = raw != null ? String(raw).trim() : "";
  if (value) return value;
  return `PRJ-${record.id}`;
};

const DealHeaderMeta = ({ record }: { record: Deal }) => {
  const { dealCategories, dealPipelines } = useConfigurationContext();
  const mainContactId = useMemo(() => {
    if (record.contact_id != null) return Number(record.contact_id);
    if (Array.isArray(record.contact_ids) && record.contact_ids.length > 0) {
      return Number(record.contact_ids[0]);
    }
    return null;
  }, [record.contact_id, record.contact_ids]);
  const { data: mainContact } = useGetOne<Contact>(
    "contacts_summary",
    { id: mainContactId as number },
    { enabled: mainContactId != null },
  );

  const projectCode = getProjectCode(record);
  const projectTypeLabel =
    record.project_type ||
    dealCategories.find((c) => c.value === record.category)?.label ||
    "Construction";
  const stageLabel = getStageLabel({ dealPipelines }, record.stage, record.pipeline_id);
  const stageColor = getStageColor({ dealPipelines }, record.stage, record.pipeline_id);
  const stageBadgeStyle = toStageBadgeStyle(stageColor);
  const contactName = getContactDisplayName(mainContact);
  const contactPhone = getContactPhone(mainContact);
  const contactEmail = getContactEmail(mainContact);

  return (
    <div className="space-y-1.5">
      <div className="w-full overflow-x-auto whitespace-nowrap text-sm text-muted-foreground">
        <span>{record.project_address || "Address not set"}</span>
        <span className="mx-1 text-muted-foreground/60">|</span>
        <span className="font-medium text-foreground/80">{projectCode}</span>
      </div>
      <div className="w-full overflow-x-auto whitespace-nowrap text-xs">
        <div className="flex min-w-max items-center gap-2 sm:min-w-0 sm:flex-wrap sm:whitespace-normal">
          <span className="rounded-full border bg-muted/40 px-2 py-0.5 font-medium text-foreground/80">
            {record.archived_at ? "Archived" : "Active"}
          </span>
          <span className="rounded-full border bg-muted/40 px-2 py-0.5 font-medium text-foreground/80">
            {projectTypeLabel}
          </span>
          <span className="rounded-full px-2 py-0.5 font-medium" style={stageBadgeStyle}>
            {stageLabel}
          </span>
          <span className="text-muted-foreground/90">
            Contact: {contactName} · {contactPhone} · {contactEmail}
          </span>
          {mainContactId != null ? (
            <Link
              className="text-primary underline underline-offset-2"
              to={`/contacts/${mainContactId}/show`}
            >
              View contact
            </Link>
          ) : null}
        </div>
      </div>
    </div>
  );
};

const toStageBadgeStyle = (color?: string): CSSProperties => {
  const safeColor = color && /^#([0-9A-Fa-f]{3}){1,2}$/.test(color) ? color : "#64748b";
  const rgba = hexToRgba(safeColor, 0.16);
  return {
    backgroundColor: rgba,
    color: safeColor,
    border: `1px solid ${hexToRgba(safeColor, 0.3)}`,
  };
};

const hexToRgba = (hex: string, alpha: number) => {
  const normalized = hex.replace("#", "");
  const full =
    normalized.length === 3
      ? normalized
          .split("")
          .map((ch) => ch + ch)
          .join("")
      : normalized;
  const bigint = Number.parseInt(full, 16);
  const r = (bigint >> 16) & 255;
  const g = (bigint >> 8) & 255;
  const b = bigint & 255;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
};

const getContactDisplayName = (contact?: Contact) => {
  if (!contact) return "No contact linked";
  const full = [contact.first_name, contact.last_name].filter(Boolean).join(" ").trim();
  return full || "Unnamed contact";
};

const getContactPhone = (contact?: Contact) => {
  if (!contact) return "—";
  const phoneEntries = Array.isArray(contact.phone_jsonb) ? contact.phone_jsonb : [];
  return phoneEntries[0]?.number || "—";
};

const getContactEmail = (contact?: Contact) => {
  if (!contact) return "—";
  const emailEntries = Array.isArray(contact.email_jsonb) ? contact.email_jsonb : [];
  return emailEntries[0]?.email || "—";
};

const getInitials = (value?: string) => {
  const parts = String(value ?? "")
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (parts.length === 0) return "NA";
  return parts
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join("");
};

const TextPreview = ({ value }: { value?: string | null }) => {
  const text = String(value ?? "").trim();
  if (!text) return <span className="text-muted-foreground">—</span>;
  const short = text.length > 60 ? `${text.slice(0, 60)}...` : text;
  return (
    <span title={text} className="block max-w-[280px] truncate">
      {short}
    </span>
  );
};

const ExpandableTextCellEditor = ({
  value,
  onChange,
  placeholder,
  error,
  maxLength = 1000,
}: {
  value: string;
  onChange: (next: string) => void;
  placeholder?: string;
  error?: string;
  maxLength?: number;
}) => {
  const [expanded, setExpanded] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    if (!expanded || !textareaRef.current) return;
    const textarea = textareaRef.current;
    textarea.style.height = "0px";
    textarea.style.height = `${textarea.scrollHeight}px`;
  }, [expanded, value]);

  return (
    <div className="space-y-1">
      <div className="flex items-start gap-1">
        <Input
          value={value}
          maxLength={maxLength}
          placeholder={placeholder}
          className={cn("min-w-[180px]", error ? "border-red-500" : "")}
          onChange={(event) => onChange(event.target.value)}
        />
        <Button
          type="button"
          size="icon"
          variant="ghost"
          className="h-8 w-8 shrink-0"
          onClick={() => setExpanded((prev) => !prev)}
        >
          {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </Button>
      </div>
      {expanded ? (
        <Textarea
          ref={textareaRef}
          value={value}
          maxLength={maxLength}
          placeholder={placeholder}
          className={cn(
            "min-h-20 resize-none overflow-hidden",
            error ? "border-red-500" : "",
          )}
          onChange={(event) => onChange(event.target.value)}
          onInput={(event) => {
            const textarea = event.currentTarget;
            textarea.style.height = "0px";
            textarea.style.height = `${textarea.scrollHeight}px`;
          }}
        />
      ) : null}
      <div className="text-right text-[10px] text-muted-foreground">
        {value.length}/{maxLength}
      </div>
      {error ? <div className="text-[11px] text-red-600">{error}</div> : null}
    </div>
  );
};

const OverviewRow = ({
  label,
  value,
  valueClassName,
}: {
  label: string;
  value: string;
  valueClassName?: string;
}) => (
  <div className="grid grid-cols-[1fr_auto] items-center gap-3 border-t py-2 text-sm first:border-t-0">
    <span className="pr-2">{label}</span>
    <span className={cn("text-right font-semibold", valueClassName)}>{value}</span>
  </div>
);

type ProjectHealthState = "healthy" | "stable" | "alert" | "loss";

const PROJECT_HEALTH_STYLE: Record<
  ProjectHealthState,
  {
    label: string;
    message: string;
    metricLabel: string;
    containerClassName: string;
    badgeClassName: string;
    amountClassName: string;
  }
> = {
  healthy: {
    label: "Healthy",
    message: "Strong margin",
    metricLabel: "Profit",
    containerClassName: "border-emerald-300 bg-emerald-50",
    badgeClassName: "bg-emerald-200 text-emerald-800",
    amountClassName: "text-emerald-700",
  },
  stable: {
    label: "Stable",
    message: "On track",
    metricLabel: "Profit",
    containerClassName: "border-blue-300 bg-blue-50",
    badgeClassName: "bg-blue-200 text-blue-800",
    amountClassName: "text-blue-700",
  },
  alert: {
    label: "Alert",
    message: "Margin risk",
    metricLabel: "Low margin",
    containerClassName: "border-amber-300 bg-amber-50",
    badgeClassName: "bg-amber-200 text-amber-900",
    amountClassName: "text-amber-700",
  },
  loss: {
    label: "Loss",
    message: "Needs review",
    metricLabel: "Loss",
    containerClassName: "border-red-300 bg-red-50",
    badgeClassName: "bg-red-200 text-red-800",
    amountClassName: "text-red-700",
  },
};

const getProjectHealthState = ({
  profit,
  collectedPercent,
  costRatio,
  marginOnCollected,
}: {
  profit: number;
  collectedPercent: number;
  costRatio: number;
  marginOnCollected: number;
}): ProjectHealthState => {
  if (profit < 0) return "loss";
  if (marginOnCollected < 0.08 || costRatio > 0.95) return "alert";
  if (marginOnCollected < 0.18 || collectedPercent < 35) return "stable";
  return "healthy";
};

const clampPercent = (value: number) => {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(100, value));
};

const toPercentLabel = (value: number) => `${(Number(value ?? 0) * 100).toFixed(1)}%`;

const SummaryItem = ({
  label,
  value,
  valueClassName,
}: {
  label: string;
  value: string;
  valueClassName?: string;
}) => (
  <div className="rounded-md border p-3">
    <div className="text-xs uppercase tracking-wide text-muted-foreground">{label}</div>
    <div className={cn("mt-1 text-sm font-medium", valueClassName)}>{value}</div>
  </div>
);

const InlineFormCard = ({
  title,
  children,
}: {
  title: string;
  children: any;
}) => (
  <div className="rounded-md border p-3">
    <div className="mb-2 text-sm font-medium">{title}</div>
    {children}
  </div>
);

const toCurrency = (value: number) =>
  Number(value ?? 0).toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
  });

const toDateLabel = (date?: string | null) => {
  if (!date) return "—";
  const parsed = new Date(date);
  return isValid(parsed) ? format(parsed, "PPP") : "—";
};

const toDayDateLabel = (date?: string | null) => {
  if (!date) return "—";
  const parsed = new Date(date);
  return isValid(parsed) ? format(parsed, "EEE yyyy-MM-dd") : "—";
};

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
