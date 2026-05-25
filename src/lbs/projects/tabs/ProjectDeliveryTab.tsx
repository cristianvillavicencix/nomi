import { lazy, Suspense } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
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

export const ProjectDeliveryTab = ({ record }: { record: LbsDeal }) => (
  <div className="space-y-4">
    <div>
      <h3 className="text-base font-semibold">Delivery</h3>
      <p className="text-sm text-muted-foreground">
        Schedule, launch checklist, and ongoing maintenance.
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
  </div>
);
