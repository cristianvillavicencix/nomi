import type { ReactNode } from "react";
import { useMemo, useState } from "react";
import { useGetList } from "ra-core";
import { useSearchParams } from "react-router";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AddTask } from "@/components/atomic-crm/tasks/AddTask";
import { ProjectCalendarEventsSection } from "@/lbs/calendar/ProjectCalendarEventsList";
import { TASK_STATUS_FILTERS, type TaskStatusFilter } from "@/components/atomic-crm/tasks/taskConstants";
import { TaskTable } from "@/components/atomic-crm/tasks/TaskTable";
import { computeTaskStats } from "@/components/atomic-crm/tasks/taskStats";
import { ProjectTaskStats } from "@/lbs/deals/ProjectTaskStats";
import { findDealLabel } from "@/components/atomic-crm/deals/deal";
import { useConfigurationContext } from "@/components/atomic-crm/root/ConfigurationContext";
import {
  ScrollableContentArea,
  StickyTabsBar,
} from "@/components/atomic-crm/layout/page-shell";
import { CreateTicketButton } from "@/lbs/tickets/CreateTicketButton";
import { WebsiteBriefTab } from "@/lbs/deals/WebsiteBriefTab";
import { BriefTabProgress } from "@/lbs/deals/BriefProgressBar";
import { getProjectBriefProgress } from "@/lbs/deals/projectBriefProgress";
import {
  getProjectResourcesProgress,
  getProjectTasksProgress,
} from "@/lbs/deals/projectTabProgress";
import { ProjectResourcesTab } from "@/lbs/deals/ProjectResourcesTab";
import { ProjectSecurityTab } from "@/lbs/deals/ProjectSecurityTab";
import { ProjectTeamChat } from "@/lbs/messages/ProjectTeamChat";
import {
  formatTabCount,
  getValidProjectTab,
} from "@/lbs/deals/dealProjectTabUtils";
import {
  isSupabaseSchemaMissingError,
  supabaseTableQueryOptions,
} from "@/lbs/deals/supabaseSchemaErrors";
import type {
  DealAccessEntry,
  DealResource,
  LbsDeal,
  Task as TaskRecord,
  Ticket,
} from "@/lbs/types";
import { Badge } from "@/components/ui/badge";
import { Link } from "react-router";

const formatMoney = (value?: number | null) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(
    Number(value ?? 0),
  );

const tabLabel = (label: string, count?: number) => `${label}${formatTabCount(count)}`;

const progressTabTriggerClassName =
  "shrink-0 flex-col items-start gap-0.5 py-1 leading-none [&>span:first-child]:text-sm";

export const DealProjectTabs = ({
  record,
  children,
}: {
  record: LbsDeal;
  children?: ReactNode;
}) => {
  const [searchParams, setSearchParams] = useSearchParams();
  const currentTab = getValidProjectTab(searchParams.get("tab"));

  const contactIds =
    record.contact_ids?.length > 0
      ? record.contact_ids
      : record.contact_id
        ? [record.contact_id]
        : [];

  const { total: openTasksCount = 0 } = useGetList<TaskRecord>(
    "tasks",
    {
      filter: {
        "deal_id@eq": record.id,
        ...TASK_STATUS_FILTERS.open,
      },
      pagination: { page: 1, perPage: 1 },
      sort: { field: "id", order: "ASC" },
    },
    { staleTime: 30_000 },
  );

  const { total: doneTasksCount = 0 } = useGetList<TaskRecord>(
    "tasks",
    {
      filter: {
        "deal_id@eq": record.id,
        ...TASK_STATUS_FILTERS.done,
      },
      pagination: { page: 1, perPage: 1 },
      sort: { field: "id", order: "ASC" },
    },
    { staleTime: 30_000 },
  );

  const {
    data: projectResources = [],
    error: resourcesListError,
  } = useGetList<DealResource>(
    "deal_resources",
    {
      filter: { "deal_id@eq": record.id },
      pagination: { page: 1, perPage: 200 },
      sort: { field: "created_at", order: "DESC" },
    },
    {
      staleTime: 30_000,
      ...supabaseTableQueryOptions("deal_resources"),
    },
  );

  const resourcesSchemaMissing = isSupabaseSchemaMissingError(
    resourcesListError,
    "deal_resources",
  );

  const { total: ticketsCount = 0 } = useGetList<Ticket>(
    "tickets",
    {
      filter: { "deal_id@eq": record.id },
      pagination: { page: 1, perPage: 1 },
      sort: { field: "id", order: "ASC" },
    },
    { staleTime: 30_000 },
  );

  const {
    total: securityCount = 0,
    error: securityError,
  } = useGetList<DealAccessEntry>(
    "deal_access_entries",
    {
      filter: { "deal_id@eq": record.id },
      pagination: { page: 1, perPage: 1 },
      sort: { field: "id", order: "ASC" },
    },
    {
      staleTime: 30_000,
      ...supabaseTableQueryOptions("deal_access_entries"),
    },
  );

  const securityTabCount = isSupabaseSchemaMissingError(
    securityError,
    "deal_access_entries",
  )
    ? undefined
    : securityCount;

  const briefProgress = useMemo(() => getProjectBriefProgress(record), [record]);
  const resourcesProgress = useMemo(
    () => (resourcesSchemaMissing ? null : getProjectResourcesProgress(projectResources)),
    [projectResources, resourcesSchemaMissing],
  );
  const tasksProgress = useMemo(
    () => getProjectTasksProgress(openTasksCount, doneTasksCount),
    [openTasksCount, doneTasksCount],
  );

  const handleTabChange = (tab: string) => {
    const nextTab = getValidProjectTab(tab);
    const nextSearchParams = new URLSearchParams(searchParams);
    if (nextTab === "overview") {
      nextSearchParams.delete("tab");
    } else {
      nextSearchParams.set("tab", nextTab);
    }
    setSearchParams(nextSearchParams, { replace: true });
  };

  return (
    <Card className="gap-0 rounded-t-none border-t-0 pt-0 -mt-px">
      <CardContent className="px-6 pt-1">
        <Tabs value={currentTab} onValueChange={handleTabChange}>
          <StickyTabsBar className="pb-1">
            <TabsList className="inline-flex h-auto w-full justify-start gap-1 overflow-x-auto rounded-lg bg-muted p-1">
              <TabsTrigger value="overview" className="shrink-0">
                Overview
              </TabsTrigger>
              <TabsTrigger value="website-brief" className={progressTabTriggerClassName}>
                <span>Brief</span>
                <BriefTabProgress percent={briefProgress.percent} />
              </TabsTrigger>
              <TabsTrigger value="resources" className={progressTabTriggerClassName}>
                <span>Resources</span>
                {resourcesProgress ? (
                  <BriefTabProgress percent={resourcesProgress.percent} />
                ) : null}
              </TabsTrigger>
              <TabsTrigger value="security" className="shrink-0">
                {tabLabel("Security", securityTabCount)}
              </TabsTrigger>
              <TabsTrigger value="tasks" className={progressTabTriggerClassName}>
                <span>Tasks</span>
                <BriefTabProgress percent={tasksProgress.percent} />
              </TabsTrigger>
              <TabsTrigger value="tickets" className="shrink-0">
                {tabLabel("Tickets", ticketsCount)}
              </TabsTrigger>
              <TabsTrigger value="messages" className="shrink-0">
                Messages
              </TabsTrigger>
            </TabsList>
          </StickyTabsBar>
          <ScrollableContentArea>
            <TabsContent value="overview" className="pt-4">
              {children ?? <DealOverviewFallback record={record} />}
            </TabsContent>
            <TabsContent value="website-brief" className="pt-4">
              <WebsiteBriefTab record={record} />
            </TabsContent>
            <TabsContent value="resources" className="pt-4">
              <ProjectResourcesTab record={record} />
            </TabsContent>
            <TabsContent value="security" className="pt-4">
              <ProjectSecurityTab record={record} />
            </TabsContent>
            <TabsContent value="tasks" className="pt-4">
              <DealTasksTab record={record} contactIds={contactIds} />
            </TabsContent>
            <TabsContent value="tickets" className="pt-4">
              <DealTicketsTab dealId={record.id} companyId={record.company_id} />
            </TabsContent>
            <TabsContent value="messages" className="pt-4">
              <ProjectTeamChat record={record} />
            </TabsContent>
          </ScrollableContentArea>
        </Tabs>
      </CardContent>
    </Card>
  );
};

const DealOverviewFallback = ({ record }: { record: LbsDeal }) => {
  const { dealStages } = useConfigurationContext();

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <div>
        <div className="text-sm text-muted-foreground">Stage</div>
        <div className="font-medium">
          {findDealLabel(dealStages, record.stage)}
        </div>
      </div>
      <div>
        <div className="text-sm text-muted-foreground">Amount</div>
        <div className="font-medium">{formatMoney(record.amount)}</div>
      </div>
      {record.description ? (
        <div className="sm:col-span-2">
          <div className="text-sm text-muted-foreground">Description</div>
          <div className="whitespace-pre-wrap">{record.description}</div>
        </div>
      ) : null}
    </div>
  );
};

const DealTasksTab = ({
  record,
  contactIds,
}: {
  record: LbsDeal;
  contactIds: LbsDeal["contact_ids"];
}) => {
  const [status, setStatus] = useState<TaskStatusFilter>("open");
  const taskContactId =
    record.contact_id ??
    (Array.isArray(record.contact_ids) ? record.contact_ids[0] : null) ??
    (contactIds.length > 0 ? contactIds[0] : null);

  const filter = useMemo(
    () => ({
      "deal_id@eq": record.id,
      ...TASK_STATUS_FILTERS[status],
    }),
    [record.id, status],
  );

  const { data: openTasksForStats = [] } = useGetList<TaskRecord>(
    "tasks",
    {
      filter: {
        "deal_id@eq": record.id,
        ...TASK_STATUS_FILTERS.open,
      },
      pagination: { page: 1, perPage: 100 },
      sort: { field: "due_date", order: "ASC" },
    },
    { staleTime: 30_000 },
  );

  const { data: tasks = [], isPending } = useGetList<TaskRecord>(
    "tasks",
    {
      filter,
      pagination: { page: 1, perPage: 100 },
      sort: {
        field: status === "done" ? "done_date" : "due_date",
        order: status === "done" ? "DESC" : "ASC",
      },
    },
    { staleTime: 30_000 },
  );

  if (isPending) return null;

  const stats = computeTaskStats(openTasksForStats);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
        <div className="flex min-w-0 flex-wrap items-center gap-3">
          <Tabs value={status} onValueChange={(value) => setStatus(value as TaskStatusFilter)}>
            <TabsList className="inline-flex h-auto w-max shrink-0 justify-start gap-1 rounded-lg bg-muted p-1">
              <TabsTrigger value="open" className="shrink-0">
                Open
              </TabsTrigger>
              <TabsTrigger value="done" className="shrink-0">
                Done
              </TabsTrigger>
            </TabsList>
          </Tabs>
          <ProjectTaskStats stats={stats} variant="compact" />
        </div>

        {taskContactId ? (
          <AddTask
            contactId={contactIds.length === 1 ? taskContactId : undefined}
            contactIds={contactIds.length > 1 ? contactIds : undefined}
            contactFilter={
              contactIds.length > 1
                ? { "id@in": `(${contactIds.join(",")})` }
                : undefined
            }
            dealId={record.id}
            display="chip"
          />
        ) : (
          <p className="text-sm text-muted-foreground">
            Link a contact to this project before creating tasks.
          </p>
        )}
      </div>

      <ProjectCalendarEventsSection
        dealId={record.id}
        showCompleted={status === "done"}
        title={status === "done" ? "Completed events" : "Upcoming events"}
      />

      <TaskTable
        tasks={tasks}
        emptyMessage={
          status === "done"
            ? "No completed tasks for this project yet."
            : "No open tasks for this project yet."
        }
      />
    </div>
  );
};

const DealLinkedRecordsList = <
  T extends {
    id: unknown;
    subject?: string;
    status?: string;
  },
>({
  items,
  emptyLabel,
  getHref,
  getLabel,
}: {
  items: T[];
  emptyLabel: string;
  getHref: (item: T) => string;
  getLabel: (item: T) => string;
}) => {
  if (items.length === 0) {
    return <p className="text-sm text-muted-foreground">{emptyLabel}</p>;
  }

  return (
    <div className="space-y-2">
      {items.map((item) => (
        <Link
          key={String(item.id)}
          to={getHref(item)}
          className="flex items-center justify-between rounded-lg border p-3 text-sm hover:bg-muted/50"
        >
          <div>
            <div className="font-medium">{getLabel(item)}</div>
            {item.status ? (
              <Badge variant="outline" className="mt-1 capitalize">
                {item.status.replace(/-/g, " ")}
              </Badge>
            ) : null}
          </div>
        </Link>
      ))}
    </div>
  );
};

const DealTicketsTab = ({
  dealId,
  companyId,
}: {
  dealId: LbsDeal["id"];
  companyId?: LbsDeal["company_id"];
}) => {
  const { data = [], isPending } = useGetList<Ticket>(
    "tickets",
    {
      filter: { "deal_id@eq": dealId },
      pagination: { page: 1, perPage: 50 },
      sort: { field: "updated_at", order: "DESC" },
    },
    { staleTime: 30_000 },
  );

  if (isPending) return null;

  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <CreateTicketButton companyId={companyId} dealId={dealId} />
      </div>
      <DealLinkedRecordsList
        items={data}
        emptyLabel="No tickets linked to this project."
        getHref={(item) => `/tickets/${item.id}/show`}
        getLabel={(item) => item.subject ?? `Ticket #${item.id}`}
      />
    </div>
  );
};
