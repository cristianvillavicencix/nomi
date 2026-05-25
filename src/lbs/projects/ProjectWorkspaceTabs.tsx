import { lazy, Suspense, useMemo, useState } from "react";
import { useGetList } from "ra-core";
import { useSearchParams } from "react-router";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AddTask } from "@/components/atomic-crm/tasks/AddTask";
import {
  TASK_STATUS_FILTERS,
  type TaskStatusFilter,
} from "@/components/atomic-crm/tasks/taskConstants";
import { TaskTable } from "@/components/atomic-crm/tasks/TaskTable";
import { computeTaskStats } from "@/components/atomic-crm/tasks/taskStats";
import { ProjectTaskStats } from "@/lbs/deals/ProjectTaskStats";
import {
  ScrollableContentArea,
  StickyTabsBar,
} from "@/components/atomic-crm/layout/page-shell";
import { WebsiteBriefTab } from "@/lbs/deals/WebsiteBriefTab";
import { BriefTabProgress } from "@/lbs/deals/BriefProgressBar";
import { getProjectBriefProgress } from "@/lbs/deals/projectBriefProgress";
import {
  getProjectResourcesProgress,
  getProjectTasksProgress,
} from "@/lbs/deals/projectTabProgress";
import { ProjectResourcesTab } from "@/lbs/deals/ProjectResourcesTab";
import { LbsProjectOverviewTab } from "@/lbs/deals/LbsProjectOverviewTab";
import { useMemberCapability } from "@/components/atomic-crm/providers/commons/useMemberCapability";
import {
  formatTabCount,
  getValidProjectTab,
} from "@/lbs/deals/dealProjectTabUtils";
import {
  isSupabaseSchemaMissingError,
  supabaseTableQueryOptions,
} from "@/lbs/deals/supabaseSchemaErrors";
import { useDealResourcesRealtime } from "@/lbs/deals/useDealResourcesRealtime";
import type { DealResource, LbsDeal, Task as TaskRecord } from "@/lbs/types";
import { ProjectContextPanel } from "@/lbs/projects/ProjectContextPanel";

const ProjectScopeTab = lazy(() =>
  import("@/lbs/projects/tabs/ProjectScopeTab").then((m) => ({
    default: m.ProjectScopeTab,
  })),
);
const ProjectContentTab = lazy(() =>
  import("@/lbs/projects/tabs/ProjectContentTab").then((m) => ({
    default: m.ProjectContentTab,
  })),
);
const ProjectDeliveryTab = lazy(() =>
  import("@/lbs/projects/tabs/ProjectDeliveryTab").then((m) => ({
    default: m.ProjectDeliveryTab,
  })),
);
const ProjectFinancialsTab = lazy(() =>
  import("@/lbs/projects/tabs/ProjectFinancialsTab").then((m) => ({
    default: m.ProjectFinancialsTab,
  })),
);
const ProjectActivityTab = lazy(() =>
  import("@/lbs/projects/tabs/ProjectActivityTab").then((m) => ({
    default: m.ProjectActivityTab,
  })),
);
const ProjectSettingsTab = lazy(() =>
  import("@/lbs/projects/tabs/ProjectSettingsTab").then((m) => ({
    default: m.ProjectSettingsTab,
  })),
);
const ProjectMessagesTab = lazy(() =>
  import("@/lbs/projects/tabs/ProjectMessagesTab").then((m) => ({
    default: m.ProjectMessagesTab,
  })),
);

const TabFallback = () => <Skeleton className="h-40 w-full rounded-lg" />;

const _tabLabel = (label: string, count?: number) =>
  `${label}${formatTabCount(count)}`;

const progressTabTriggerClassName =
  "shrink-0 flex-col items-start gap-0.5 py-1 leading-none [&>span:first-child]:text-sm";

export const ProjectWorkspaceTabs = ({ record }: { record: LbsDeal }) => {
  const [searchParams, setSearchParams] = useSearchParams();
  const currentTab = getValidProjectTab(searchParams.get("tab"));
  const [visited, setVisited] = useState<Set<string>>(
    () => new Set(["overview"]),
  );

  const contactIds =
    record.contact_ids?.length > 0
      ? record.contact_ids
      : record.contact_id
        ? [record.contact_id]
        : [];

  const { total: openTasksCount = 0 } = useGetList<TaskRecord>(
    "tasks",
    {
      filter: { "deal_id@eq": record.id, ...TASK_STATUS_FILTERS.open },
      pagination: { page: 1, perPage: 1 },
      sort: { field: "id", order: "ASC" },
    },
    { staleTime: 30_000 },
  );

  const { total: doneTasksCount = 0 } = useGetList<TaskRecord>(
    "tasks",
    {
      filter: { "deal_id@eq": record.id, ...TASK_STATUS_FILTERS.done },
      pagination: { page: 1, perPage: 1 },
      sort: { field: "id", order: "ASC" },
    },
    { staleTime: 30_000 },
  );

  const { data: projectResources = [], error: resourcesListError } =
    useGetList<DealResource>(
      "deal_resources",
      {
        filter: { "deal_id@eq": record.id },
        pagination: { page: 1, perPage: 200 },
        sort: { field: "created_at", order: "DESC" },
      },
      { staleTime: 30_000, ...supabaseTableQueryOptions("deal_resources") },
    );

  const resourcesSchemaMissing = isSupabaseSchemaMissingError(
    resourcesListError,
    "deal_resources",
  );
  const briefProgress = useMemo(
    () => getProjectBriefProgress(record),
    [record],
  );
  const canViewExpenses = useMemberCapability("deal_financials.expenses.view");
  const canViewChangeOrders = useMemberCapability(
    "deal_financials.change_orders.view",
  );
  const canViewPayments = useMemberCapability(
    "deal_financials.collections.view",
  );
  const canViewCommissions = useMemberCapability(
    "deal_financials.commissions.view",
  );
  const resourcesProgress = useMemo(
    () =>
      resourcesSchemaMissing
        ? null
        : getProjectResourcesProgress(projectResources),
    [projectResources, resourcesSchemaMissing],
  );
  const tasksProgress = useMemo(
    () => getProjectTasksProgress(openTasksCount, doneTasksCount),
    [openTasksCount, doneTasksCount],
  );

  const canViewFinancials =
    canViewExpenses ||
    canViewChangeOrders ||
    canViewPayments ||
    canViewCommissions;

  useDealResourcesRealtime(record.id, !resourcesSchemaMissing);

  const handleTabChange = (tab: string) => {
    const nextTab = getValidProjectTab(tab);
    setVisited((prev) => new Set(prev).add(nextTab));
    const nextSearchParams = new URLSearchParams(searchParams);
    if (nextTab === "overview") nextSearchParams.delete("tab");
    else nextSearchParams.set("tab", nextTab);
    setSearchParams(nextSearchParams, { replace: true });
  };

  const showTab = (tab: string) => visited.has(tab) || currentTab === tab;

  return (
    <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_280px]">
      <Card className="gap-0 rounded-t-none border-t-0 pt-0 -mt-px min-w-0">
        <CardContent className="px-4 pt-1 sm:px-6">
          <Tabs value={currentTab} onValueChange={handleTabChange}>
            <StickyTabsBar className="pb-1">
              <TabsList className="inline-flex h-auto w-full justify-start gap-1 overflow-x-auto rounded-lg bg-muted p-1">
                <TabsTrigger value="overview" className="shrink-0">
                  Overview
                </TabsTrigger>
                <TabsTrigger value="scope" className="shrink-0">
                  Scope
                </TabsTrigger>
                <TabsTrigger
                  value="website-brief"
                  className={progressTabTriggerClassName}
                >
                  <span>Brief</span>
                  <BriefTabProgress percent={briefProgress.percent} />
                </TabsTrigger>
                <TabsTrigger value="content" className="shrink-0">
                  Content
                </TabsTrigger>
                <TabsTrigger
                  value="resources"
                  className={progressTabTriggerClassName}
                >
                  <span>Assets</span>
                  {resourcesProgress ? (
                    <BriefTabProgress percent={resourcesProgress.percent} />
                  ) : null}
                </TabsTrigger>
                <TabsTrigger
                  value="tasks"
                  className={progressTabTriggerClassName}
                >
                  <span>Tasks</span>
                  <BriefTabProgress percent={tasksProgress.percent} />
                </TabsTrigger>
                <TabsTrigger value="delivery" className="shrink-0">
                  Delivery
                </TabsTrigger>
                <TabsTrigger value="messages" className="shrink-0">
                  Messages
                </TabsTrigger>
                {canViewFinancials ? (
                  <TabsTrigger value="financials" className="shrink-0">
                    Financials
                  </TabsTrigger>
                ) : null}
                <TabsTrigger value="activity" className="shrink-0">
                  Activity
                </TabsTrigger>
                <TabsTrigger value="settings" className="shrink-0">
                  Settings
                </TabsTrigger>
              </TabsList>
            </StickyTabsBar>
            <ScrollableContentArea>
              <TabsContent value="overview" className="pt-4">
                <LbsProjectOverviewTab record={record} />
              </TabsContent>
              <TabsContent value="scope" className="pt-4">
                {showTab("scope") ? (
                  <Suspense fallback={<TabFallback />}>
                    <ProjectScopeTab record={record} />
                  </Suspense>
                ) : null}
              </TabsContent>
              <TabsContent value="website-brief" className="pt-4">
                <WebsiteBriefTab record={record} />
              </TabsContent>
              <TabsContent value="content" className="pt-4">
                {showTab("content") ? (
                  <Suspense fallback={<TabFallback />}>
                    <ProjectContentTab record={record} />
                  </Suspense>
                ) : null}
              </TabsContent>
              <TabsContent value="resources" className="pt-4">
                <ProjectResourcesTab record={record} />
              </TabsContent>
              <TabsContent value="tasks" className="pt-4">
                <ProjectTasksPanel record={record} contactIds={contactIds} />
              </TabsContent>
              <TabsContent value="delivery" className="pt-4">
                {showTab("delivery") ? (
                  <Suspense fallback={<TabFallback />}>
                    <ProjectDeliveryTab record={record} />
                  </Suspense>
                ) : null}
              </TabsContent>
              <TabsContent value="messages" className="pt-4">
                {showTab("messages") ? (
                  <Suspense fallback={<TabFallback />}>
                    <ProjectMessagesTab record={record} />
                  </Suspense>
                ) : null}
              </TabsContent>
              {canViewFinancials ? (
                <TabsContent value="financials" className="pt-4">
                  {showTab("financials") ? (
                    <Suspense fallback={<TabFallback />}>
                      <ProjectFinancialsTab record={record} />
                    </Suspense>
                  ) : null}
                </TabsContent>
              ) : null}
              <TabsContent value="activity" className="pt-4">
                {showTab("activity") ? (
                  <Suspense fallback={<TabFallback />}>
                    <ProjectActivityTab record={record} />
                  </Suspense>
                ) : null}
              </TabsContent>
              <TabsContent value="settings" className="pt-4">
                {showTab("settings") ? (
                  <Suspense fallback={<TabFallback />}>
                    <ProjectSettingsTab record={record} />
                  </Suspense>
                ) : null}
              </TabsContent>
            </ScrollableContentArea>
          </Tabs>
        </CardContent>
      </Card>

      <aside className="hidden xl:block">
        <ProjectContextPanel record={record} resources={projectResources} />
      </aside>
    </div>
  );
};

/** @deprecated Use ProjectWorkspaceTabs */
export const DealProjectTabs = ProjectWorkspaceTabs;

const ProjectTasksPanel = ({
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
    () => ({ "deal_id@eq": record.id, ...TASK_STATUS_FILTERS[status] }),
    [record.id, status],
  );

  const { data: openTasksForStats = [] } = useGetList<TaskRecord>(
    "tasks",
    {
      filter: { "deal_id@eq": record.id, ...TASK_STATUS_FILTERS.open },
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

  if (isPending) return <TabFallback />;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
        <div className="flex min-w-0 flex-wrap items-center gap-3">
          <Tabs
            value={status}
            onValueChange={(v) => setStatus(v as TaskStatusFilter)}
          >
            <TabsList className="inline-flex h-auto w-max shrink-0 gap-1 rounded-lg bg-muted p-1">
              <TabsTrigger value="open" className="shrink-0">
                Open
              </TabsTrigger>
              <TabsTrigger value="done" className="shrink-0">
                Done
              </TabsTrigger>
            </TabsList>
          </Tabs>
          <ProjectTaskStats
            stats={computeTaskStats(openTasksForStats)}
            variant="compact"
          />
        </div>
        {taskContactId ? (
          <AddTask
            contactId={contactIds.length === 1 ? taskContactId : undefined}
            contactIds={contactIds.length > 1 ? contactIds : undefined}
            dealId={record.id}
            display="chip"
          />
        ) : (
          <p className="text-sm text-muted-foreground">
            Link a contact to create tasks.
          </p>
        )}
      </div>
      <TaskTable
        tasks={tasks}
        emptyMessage={
          status === "done" ? "No completed tasks." : "No open tasks."
        }
      />
    </div>
  );
};
