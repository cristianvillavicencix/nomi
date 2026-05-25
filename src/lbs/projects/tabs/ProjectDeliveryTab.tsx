import { lazy, Suspense, useState } from "react";
import { Rocket } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ProjectGithubLink } from "@/lbs/deals/ProjectGithubLink";
import { ClientPortalSection } from "@/lbs/portal/ClientPortalSection";
import { ProjectDeploymentCard } from "@/lbs/projects/ProjectDeploymentCard";
import { DeliverProjectDialog } from "@/lbs/projects/delivery/DeliverProjectDialog";
import type { LbsDeal } from "@/lbs/types";

const ProjectScheduleTab = lazy(() =>
  import("@/lbs/projects/tabs/ProjectScheduleTab").then((m) => ({
    default: m.ProjectScheduleTab,
  })),
);
const LaunchChecklistTab = lazy(() =>
  import("@/lbs/projects/launch/LaunchChecklistTab").then((m) => ({
    default: m.LaunchChecklistTab,
  })),
);
const MaintenanceTab = lazy(() =>
  import("@/lbs/projects/tabs/MaintenanceTab").then((m) => ({
    default: m.MaintenanceTab,
  })),
);

const TabFallback = () => <Skeleton className="h-40 w-full rounded-lg" />;

export const ProjectDeliveryTab = ({ record }: { record: LbsDeal }) => {
  const [deliverOpen, setDeliverOpen] = useState(false);

  return (
  <div className="space-y-6">
    <ClientPortalSection record={record} />

    <div className="flex flex-col gap-3 rounded-lg border border-[#1E5FA8]/20 bg-[#1E5FA8]/5 p-4 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <h3 className="text-base font-semibold">Client handoff</h3>
        <p className="text-sm text-muted-foreground">
          Deliver the project to unlock <strong>Mi Sitio Web</strong> in the
          client portal with URLs, files, and credentials.
        </p>
      </div>
      <Button type="button" onClick={() => setDeliverOpen(true)}>
        <Rocket className="size-4" />
        Deliver project
      </Button>
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

    <DeliverProjectDialog
      open={deliverOpen}
      onClose={() => setDeliverOpen(false)}
      record={record}
    />
  </div>
  );
};
