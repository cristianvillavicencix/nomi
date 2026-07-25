import { ShowBase } from "ra-core";
import { LeadCompactPreview } from "@/modules/leads/LeadCompactPreview";
import { LeadShowContent } from "@/modules/leads/LeadShowContent";
import type { LeadStageId } from "@/modules/leads/leadStages";

type LeadDetailPanelProps = {
  leadId: string;
  kanbanStage: LeadStageId;
  /** Compact single-column drawer preview (board Sheet). */
  preview?: boolean;
};

export const LeadDetailPanel = ({
  leadId,
  kanbanStage,
  preview = false,
}: LeadDetailPanelProps) => (
  <div className="flex h-full min-h-0 flex-col overflow-hidden bg-background">
    <ShowBase resource="contacts" id={leadId} key={leadId}>
      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
        {preview ? (
          <LeadCompactPreview />
        ) : (
          <LeadShowContent embedded kanbanStage={kanbanStage} />
        )}
      </div>
    </ShowBase>
  </div>
);
