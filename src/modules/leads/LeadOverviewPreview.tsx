import { ArrowRight, PanelRightClose } from "lucide-react";
import { Link } from "react-router";
import { getLeadShowPath } from "@/app/routing";
import { Button } from "@/components/ui/button";
import { IconButton } from "@/components/ui/icon-button";
import { LeadDetailPanel } from "@/modules/leads/LeadDetailPanel";
import type { LeadStageId } from "@/modules/leads/leadStages";

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
    <div className="flex shrink-0 items-center justify-between gap-2 border-b px-4 py-3">
      <div className="flex min-w-0 items-center gap-1.5">
        <IconButton
          className="shrink-0"
          onClick={onClose}
          aria-label="Close preview"
        >
          <PanelRightClose className="size-4" />
        </IconButton>
        <p className="truncate text-base font-semibold">{title}</p>
      </div>
      <Button
        variant="primary"
        size="sm"
        className="h-8 shrink-0 gap-1.5"
        asChild
      >
        <Link to={fullViewPath ?? getLeadShowPath(leadId)}>
          View full details
          <ArrowRight className="size-3.5" />
        </Link>
      </Button>
    </div>
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
