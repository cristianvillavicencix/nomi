import { lazy, Suspense } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { ProjectActivityTab } from "@/modules/deals/projects/tabs/ProjectActivityTab";
import { ProjectMessagesTab } from "@/modules/deals/projects/tabs/ProjectMessagesTab";
import type { LbsDeal } from "@/modules/types";

const ProjectScheduleTab = lazy(() =>
  import("@/modules/deals/projects/tabs/ProjectScheduleTab").then((m) => ({
    default: m.ProjectScheduleTab,
  })),
);

const SectionFallback = () => <Skeleton className="h-40 w-full rounded-lg" />;

export const LbsProjectOverviewTab = ({ record }: { record: LbsDeal }) => {
  return (
    <div className="space-y-6">
      <ProjectMessagesTab record={record} />

      <div className="overflow-hidden rounded-md border">
        <div className="border-b bg-muted/20 px-4 py-3">
          <h3 className="text-sm font-semibold">Activity</h3>
          <p className="text-xs text-muted-foreground">
            Recent updates on this project.
          </p>
        </div>
        <div className="overflow-x-auto">
          <ProjectActivityTab record={record} />
        </div>
      </div>

      <div className="overflow-hidden rounded-md border">
        <div className="border-b bg-muted/20 px-4 py-3">
          <h3 className="text-sm font-semibold">Timeline</h3>
          <p className="text-xs text-muted-foreground">
            Milestones and key dates for this project.
          </p>
        </div>
        <div className="p-4">
          <Suspense fallback={<SectionFallback />}>
            <ProjectScheduleTab record={record} />
          </Suspense>
        </div>
      </div>
    </div>
  );
};
