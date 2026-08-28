import { Link } from "react-router";
import { getLeadShowPath } from "@/app/routing";
import { LeadDetailPanel } from "@/modules/leads/LeadDetailPanel";
import type { LeadStageId } from "@/modules/leads/leadStages";
import { ProfilePreviewChrome } from "@/modules/shared/profile";

/** Sheet-overlay preview for Accounts board/list — compact drawer, not full show. */
export const LeadOverviewPreview = ({
  leadId,
  stage,
  onClose,
  fullViewPath,
  title = "Lead Preview",
}: {
  leadId: string;
  stage: LeadStageId;
  onClose: () => void;
  fullViewPath?: string;
  title?: string;
}) => (
  <div className="flex h-full min-h-0 flex-col overflow-hidden bg-background">
    <ProfilePreviewChrome
      title={title}
      onClose={onClose}
      fullViewPath={fullViewPath ?? getLeadShowPath(leadId)}
    />
    <div className="min-h-0 flex-1 overflow-hidden">
      <LeadDetailPanel
        key={leadId}
        leadId={leadId}
        kanbanStage={stage}
        preview
      />
    </div>
  </div>
);
