import { ShowBase } from "ra-core";
import { LeadShowContent } from "@/modules/leads/LeadShowContent";
import type { LeadStageId } from "@/modules/leads/leadStages";

type LeadDetailPanelProps = {
  leadId: string;
  kanbanStage: LeadStageId;
};

export const LeadDetailPanel = ({
  leadId,
  kanbanStage,
}: LeadDetailPanelProps) => (
  <div className="flex h-full min-h-0 flex-col overflow-hidden bg-background">
    <ShowBase resource="contacts" id={leadId} key={leadId}>
      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
        <LeadShowContent embedded kanbanStage={kanbanStage} />
      </div>
    </ShowBase>
  </div>
);
