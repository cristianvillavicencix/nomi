import { lazy, Suspense, useMemo, useState } from "react";
import { useGetList } from "ra-core";
import { useSearchParams } from "react-router";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  ScrollableContentArea,
  StickyTabsBar,
} from "@/components/atomic-crm/layout/page-shell";
import { WebsiteBriefTab } from "@/modules/deals/WebsiteBriefTab";
import { BriefTabProgress } from "@/modules/deals/BriefProgressBar";
import { getProjectBriefProgress } from "@/modules/deals/projectBriefProgress";
import { getProjectResourcesProgress } from "@/modules/deals/projectTabProgress";
import { ProjectResourcesTab } from "@/modules/deals/ProjectResourcesTab";
import { LbsProjectOverviewTab } from "@/modules/deals/LbsProjectOverviewTab";
import { useMemberCapability } from "@/components/atomic-crm/providers/commons/useMemberCapability";
import {
  DEFAULT_PROJECT_TAB,
  getValidProjectTab,
  resolveProjectTabSelection,
} from "@/modules/deals/dealProjectTabUtils";
import { ProjectSecurityWorkspaceTab } from "@/modules/deals/projects/tabs/ProjectSecurityTab";
import { ProjectMessagesPanel } from "@/modules/deals/projects/ProjectMessagesPanel";
import { ProjectTasksPanel } from "@/modules/deals/projects/ProjectTasksPanel";
import {
  isSupabaseSchemaMissingError,
  supabaseTableQueryOptions,
} from "@/modules/deals/supabaseSchemaErrors";
import { useDealsRealtime } from "@/components/atomic-crm/deals/useDealsRealtime";
import { useDealResourcesRealtime } from "@/modules/deals/useDealResourcesRealtime";
import type { DealResource, LbsDeal } from "@/modules/types";

const resolveContactIds = (record: LbsDeal): LbsDeal["contact_ids"] => {
  if (record.contact_ids && record.contact_ids.length > 0) {
    return record.contact_ids;
  }
  if (record.contact_id != null) return [record.contact_id];
  return [];
};

const ProjectFinancialsTab = lazy(() =>
  import("@/modules/deals/projects/tabs/ProjectFinancialsTab").then((m) => ({
    default: m.ProjectFinancialsTab,
  })),
);
const TabFallback = () => <Skeleton className="h-40 w-full rounded-lg" />;

const progressTabTriggerClassName =
  "shrink-0 flex-col items-start gap-0.5 py-1 leading-none [&>span:first-child]:text-sm";

export const ProjectWorkspaceTabs = ({ record }: { record: LbsDeal }) => {
  const [searchParams, setSearchParams] = useSearchParams();
  const currentTab = getValidProjectTab(searchParams.get("tab"));
  const [visited, setVisited] = useState<Set<string>>(
    () => new Set([DEFAULT_PROJECT_TAB]),
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
  const resourcesProgress = useMemo(
    () =>
      resourcesSchemaMissing
        ? null
        : getProjectResourcesProgress(projectResources),
    [projectResources, resourcesSchemaMissing],
  );

  const canViewFinancials =
    canViewExpenses || canViewChangeOrders || canViewPayments;

  useDealsRealtime();
  useDealResourcesRealtime(record.id, !resourcesSchemaMissing);

  const handleTabChange = (tab: string) => {
    const nextTab = resolveProjectTabSelection(tab);
    setVisited((prev) => new Set(prev).add(nextTab));
    const nextSearchParams = new URLSearchParams(searchParams);
    if (nextTab === DEFAULT_PROJECT_TAB) nextSearchParams.delete("tab");
    else nextSearchParams.set("tab", nextTab);
    setSearchParams(nextSearchParams, { replace: true });
  };

  const showTab = (tab: string) => visited.has(tab) || currentTab === tab;

  return (
    <Card className="flex h-full min-h-0 min-w-0 flex-1 flex-col gap-0 border-0 py-0 shadow-none">
      <CardContent className="flex min-h-0 flex-1 flex-col px-4 pt-1 sm:px-6">
        <Tabs
          value={currentTab}
          onValueChange={handleTabChange}
          className="flex min-h-0 flex-1 flex-col"
        >
          <StickyTabsBar className="shrink-0 bg-background pb-1">
            <TabsList className="inline-flex h-auto w-full justify-start gap-1 overflow-x-auto rounded-lg bg-muted p-1">
              <TabsTrigger value="tasks" className="shrink-0">
                Tasks
              </TabsTrigger>
              <TabsTrigger
                value="website-brief"
                className={progressTabTriggerClassName}
              >
                <span>Brief</span>
                <BriefTabProgress percent={briefProgress.percent} />
              </TabsTrigger>
              <TabsTrigger
                value="resources"
                className={progressTabTriggerClassName}
              >
                <span>Multimedia</span>
                {resourcesProgress ? (
                  <BriefTabProgress percent={resourcesProgress.percent} />
                ) : null}
              </TabsTrigger>
              <TabsTrigger value="security" className="shrink-0">
                Security
              </TabsTrigger>
              {canViewFinancials ? (
                <TabsTrigger value="financials" className="shrink-0">
                  Financials
                </TabsTrigger>
              ) : null}
              <TabsTrigger value="messages" className="shrink-0">
                Messages
              </TabsTrigger>
              <TabsTrigger value="overview" className="shrink-0">
                Activities
              </TabsTrigger>
            </TabsList>
          </StickyTabsBar>
          <ScrollableContentArea className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
            <TabsContent value="tasks" className="pt-4">
              {showTab("tasks") ? (
                <ProjectTasksPanel
                  record={record}
                  contactIds={resolveContactIds(record)}
                />
              ) : null}
            </TabsContent>
            <TabsContent value="website-brief" className="pt-4">
              <WebsiteBriefTab record={record} />
            </TabsContent>
            <TabsContent value="resources" className="pt-4">
              <ProjectResourcesTab record={record} />
            </TabsContent>
            <TabsContent value="security" className="pt-4">
              <ProjectSecurityWorkspaceTab record={record} />
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
            <TabsContent value="messages" className="pt-4">
              {showTab("messages") ? (
                <div className="h-[min(32rem,60vh)] min-h-[22rem] overflow-hidden rounded-md border">
                  <ProjectMessagesPanel record={record} className="h-full" />
                </div>
              ) : null}
            </TabsContent>
            <TabsContent value="overview" className="pt-4">
              <LbsProjectOverviewTab record={record} />
            </TabsContent>
          </ScrollableContentArea>
        </Tabs>
      </CardContent>
    </Card>
  );
};

/** @deprecated Use ProjectWorkspaceTabs */
export const DealProjectTabs = ProjectWorkspaceTabs;
