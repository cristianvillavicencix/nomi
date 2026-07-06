import { LeadDetailPanel } from "@/modules/leads/LeadDetailPanel";
import { LeadStageSidebar } from "@/modules/leads/LeadStageSidebar";
import type { LeadStageId } from "@/modules/leads/leadStages";

type LeadsKanbanSplitLayoutProps = {
  selectedLeadId: string;
  stage: LeadStageId;
};

export const LeadsKanbanSplitLayout = ({
  selectedLeadId,
  stage,
}: LeadsKanbanSplitLayoutProps) => (
  <div className="grid h-full min-h-0 flex-1 overflow-hidden lg:grid-cols-[minmax(17rem,20rem)_minmax(0,1fr)]">
    <LeadStageSidebar stage={stage} selectedLeadId={selectedLeadId} />
    <div className="min-h-0 overflow-hidden bg-muted/10">
      <LeadDetailPanel leadId={selectedLeadId} kanbanStage={stage} />
    </div>
  </div>
);
