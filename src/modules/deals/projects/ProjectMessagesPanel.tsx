import { cn } from "@/lib/utils";
import type { LbsDeal } from "@/modules/types";
import { ProjectClientSmsPanel } from "@/modules/deals/projects/ProjectClientSmsPanel";

export const ProjectMessagesPanel = ({
  record,
  className,
}: {
  record: LbsDeal;
  className?: string;
}) => {
  return (
    <div
      className={cn(
        "flex h-full min-h-0 flex-1 flex-col overflow-hidden",
        className,
      )}
    >
      <ProjectClientSmsPanel record={record} className="min-h-0 flex-1" />
    </div>
  );
};
