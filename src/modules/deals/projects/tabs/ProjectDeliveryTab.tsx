import { lazy, Suspense, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useDataProvider, useGetList, useNotify, useRefresh } from "ra-core";
import { AlertTriangle, Rocket } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ProjectGithubLink } from "@/modules/deals/ProjectGithubLink";
import { ProjectDeploymentCard } from "@/modules/deals/projects/ProjectDeploymentCard";
import { DeliverProjectDialog } from "@/modules/deals/projects/delivery/DeliverProjectDialog";
import { ManualDeliveryOverrideDialog } from "@/modules/deals/projects/delivery/ManualDeliveryOverrideDialog";
import type { CrmDataProvider } from "@/components/atomic-crm/providers/types";
import type { LbsDeal } from "@/modules/types";

const ProjectScheduleTab = lazy(() =>
  import("@/modules/deals/projects/tabs/ProjectScheduleTab").then((m) => ({
    default: m.ProjectScheduleTab,
  })),
);
const LaunchChecklistTab = lazy(() =>
  import("@/modules/deals/projects/launch/LaunchChecklistTab").then((m) => ({
    default: m.LaunchChecklistTab,
  })),
);
const MaintenanceTab = lazy(() =>
  import("@/modules/deals/projects/tabs/MaintenanceTab").then((m) => ({
    default: m.MaintenanceTab,
  })),
);

const TabFallback = () => <Skeleton className="h-40 w-full rounded-lg" />;

export const ProjectDeliveryTab = ({ record }: { record: LbsDeal }) => {
  const [overrideOpen, setOverrideOpen] = useState(false);
  const [deliverOpen, setDeliverOpen] = useState(false);
  const notify = useNotify();
  const refresh = useRefresh();
  const dataProvider = useDataProvider<CrmDataProvider>();

  const { total: pendingRequiredCount = 0 } = useGetList(
    "deal_launch_checklist_items",
    {
      filter: {
        "deal_id@eq": record.id,
        "is_required@eq": true,
        "is_completed@eq": false,
      },
      pagination: { page: 1, perPage: 1 },
      sort: { field: "order_index", order: "ASC" },
    },
    { enabled: !!record.id },
  );

  const hasPendingRequired = pendingRequiredCount > 0;

  // Manual override delivery: submits the deliver_project call directly with
  // the override payload + sensible defaults from the deal. Avoids cascading
  // two Radix Dialogs (which triggered a Slot composeRefs infinite loop).
  const manualDeliverMutation = useMutation({
    mutationFn: async (payload: {
      reason: string;
      force_approved_items: Array<{
        id: number;
        label: string;
        category?: string | null;
      }>;
      site_url?: string;
    }) => {
      return dataProvider.deliverProject({
        deal_id: Number(record.id),
        site_url:
          payload.site_url ??
          String(record.production_url ?? "").trim() ??
          undefined,
        project_start_date: record.created_at
          ? String(record.created_at).slice(0, 10)
          : undefined,
        included_pages: ["home"],
        maintenance_plan: { free_months: 3 },
        notify_email: false,
        notify_portal: false,
        manual_override: {
          reason: payload.reason,
          force_approved_items: payload.force_approved_items,
        },
      });
    },
    onSuccess: () => {
      notify("Project delivered with manual override", { type: "info" });
      setOverrideOpen(false);
      refresh();
    },
    onError: (error: unknown) => {
      notify(
        error instanceof Error ? error.message : "Manual delivery failed",
        { type: "error" },
      );
    },
  });

  return (
  <div className="space-y-6">
    <div className="flex flex-col gap-3 rounded-lg border border-[#1E5FA8]/20 bg-[#1E5FA8]/5 p-4 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <h3 className="text-base font-semibold">Client handoff</h3>
        <p className="text-sm text-muted-foreground">
          Deliver the project to unlock <strong>Mi Sitio Web</strong> in the
          client portal with URLs, files, and credentials.
        </p>
        {hasPendingRequired ? (
          <p className="text-amber-700 dark:text-amber-400 mt-1 text-xs">
            {pendingRequiredCount} required launch checklist item
            {pendingRequiredCount === 1 ? "" : "s"} still pending.
          </p>
        ) : null}
      </div>
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <Button type="button" onClick={() => setDeliverOpen(true)}>
          <Rocket className="size-4" />
          Deliver project
        </Button>
        {hasPendingRequired ? (
          <Button
            type="button"
            variant="outline"
            className="border-amber-500/50 text-amber-700 hover:bg-amber-500/10 dark:text-amber-400"
            onClick={() => setOverrideOpen(true)}
          >
            <AlertTriangle className="size-4" />
            Deliver anyway
          </Button>
        ) : null}
      </div>
    </div>

    <div>
      <h3 className="text-base font-semibold">Delivery</h3>
      <p className="text-sm text-muted-foreground">
        Portal invite, handoff, schedule, launch checklist, maintenance, and
        deployment URLs.
      </p>
    </div>

    <Tabs defaultValue="schedule">
      <TabsList className="inline-flex h-auto w-full justify-start gap-1 overflow-x-auto rounded-lg bg-muted p-1">
        <TabsTrigger value="schedule" className="shrink-0">
          Schedule
        </TabsTrigger>
        <TabsTrigger value="launch" className="shrink-0">
          Launch
        </TabsTrigger>
        <TabsTrigger value="maintenance" className="shrink-0">
          Maintenance
        </TabsTrigger>
      </TabsList>

      <TabsContent value="schedule" className="pt-4">
        <Suspense fallback={<TabFallback />}>
          <ProjectScheduleTab record={record} />
        </Suspense>
      </TabsContent>
      <TabsContent value="launch" className="pt-4">
        <Suspense fallback={<TabFallback />}>
          <LaunchChecklistTab record={record} />
        </Suspense>
      </TabsContent>
      <TabsContent value="maintenance" className="pt-4">
        <Suspense fallback={<TabFallback />}>
          <MaintenanceTab record={record} />
        </Suspense>
      </TabsContent>
    </Tabs>

    <ProjectDeploymentCard record={record} />
    <ProjectGithubLink record={record} showEditLink />

    {deliverOpen ? (
      <DeliverProjectDialog
        open={deliverOpen}
        onClose={() => setDeliverOpen(false)}
        record={record}
      />
    ) : null}
    {overrideOpen ? (
      <ManualDeliveryOverrideDialog
        open={overrideOpen}
        onClose={() => {
          if (!manualDeliverMutation.isPending) setOverrideOpen(false);
        }}
        dealId={record.id}
        defaultSiteUrl={record.production_url}
        isSubmitting={manualDeliverMutation.isPending}
        onConfirm={(payload) => manualDeliverMutation.mutate(payload)}
      />
    ) : null}
  </div>
  );
};
