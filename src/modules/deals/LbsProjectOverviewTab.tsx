import { ProjectActivityTab } from "@/modules/deals/projects/tabs/ProjectActivityTab";
import type { LbsDeal } from "@/modules/types";

export const LbsProjectOverviewTab = ({ record }: { record: LbsDeal }) => {
  return (
    <div className="overflow-hidden rounded-md border">
      <div className="border-b bg-muted/20 px-4 py-3">
        <h3 className="text-sm font-semibold">Activity</h3>
        <p className="text-xs text-muted-foreground">
          Recent updates on this project.
        </p>
      </div>
      <div className="p-4">
        <ProjectActivityTab record={record} />
      </div>
    </div>
  );
};
