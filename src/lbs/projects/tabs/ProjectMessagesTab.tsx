import { ProjectTeamChat } from "@/lbs/messages/ProjectTeamChat";
import { DealClientSmsButton } from "@/lbs/deals/DealClientSmsButton";
import type { LbsDeal } from "@/lbs/types";

export const ProjectMessagesTab = ({ record }: { record: LbsDeal }) => (
  <div className="space-y-4">
    <div className="flex flex-wrap items-center justify-between gap-2">
      <div>
        <h3 className="font-semibold">Project messages</h3>
        <p className="text-sm text-muted-foreground">
          Internal team chat and client SMS for this project.
        </p>
      </div>
      <DealClientSmsButton record={record} />
    </div>
    <ProjectTeamChat record={record} />
  </div>
);
