import { useMemo, useState } from "react";
import { useListContext, useRefresh } from "ra-core";
import { useNavigate } from "react-router";
import { LayoutGrid } from "lucide-react";
import type { Contact } from "@/components/atomic-crm/types";
import { getClientShowPath } from "@/app/routing";
import { Button } from "@/components/ui/button";
import { ConvertWonLeadDialog } from "@/modules/leads/ConvertWonLeadDialog";
import { LeadCard } from "@/modules/leads/LeadCard";
import { LeadKanbanProvider } from "@/modules/leads/LeadKanbanContext";
import { LeadStageChangeDialog } from "@/modules/leads/LeadStageChangeDialog";
import {
  countLeadsByBoardStage,
  filterLeadsForKanbanStage,
  leadKanbanShowPath,
  leadsKanbanBoardPath,
} from "@/modules/leads/leadKanbanNavigation";
import { LeadStageBreadcrumb } from "@/modules/leads/LeadStageBreadcrumb";
import { isLeadTerminalStage } from "@/modules/leads/leadFollowUpUtils";
import {
  getLeadStageDef,
  type LeadStageId,
  normalizeLeadStage,
} from "@/modules/leads/leadStages";
import { useLeadKanbanEnrichment } from "@/modules/leads/useLeadKanbanEnrichment";

type LeadStageSidebarProps = {
  stage: LeadStageId;
  selectedLeadId: string;
};

type PendingStageTransition = {
  lead: Contact;
  fromStage: LeadStageId;
  toStage: LeadStageId;
};

export const LeadStageSidebar = ({
  stage,
  selectedLeadId,
}: LeadStageSidebarProps) => {
  const navigate = useNavigate();
  const refresh = useRefresh();
  const { data = [] } = useListContext<Contact>();
  const stageDef = getLeadStageDef(stage);
  const [pendingTransition, setPendingTransition] =
    useState<PendingStageTransition | null>(null);
  const [stageDialogOpen, setStageDialogOpen] = useState(false);
  const [convertCandidate, setConvertCandidate] = useState<Contact | null>(
    null,
  );

  const { membersById, conversationsByContactId } =
    useLeadKanbanEnrichment(data);

  const kanbanContextValue = useMemo(
    () => ({
      membersById,
      conversationsByContactId,
      requestStageChange: (lead: Contact, toStage: LeadStageId) => {
        const fromStage = normalizeLeadStage(lead.lead_stage);
        if (fromStage === toStage) return;
        setPendingTransition({ lead, fromStage, toStage });
        setStageDialogOpen(true);
      },
    }),
    [conversationsByContactId, membersById],
  );

  const activeLeads = useMemo(
    () => (data ?? []).filter((lead) => !isLeadTerminalStage(lead.lead_stage)),
    [data],
  );

  const counts = useMemo(
    () => countLeadsByBoardStage(activeLeads),
    [activeLeads],
  );

  const stageLeads = useMemo(
    () => filterLeadsForKanbanStage(activeLeads, stage),
    [activeLeads, stage],
  );

  const handleStageSelect = (nextStage: LeadStageId) => {
    if (nextStage === stage) return;

    const nextStageLeads = filterLeadsForKanbanStage(activeLeads, nextStage);
    const selectedInNextStage = nextStageLeads.find(
      (lead) => String(lead.id) === selectedLeadId,
    );

    if (selectedInNextStage) {
      navigate(leadKanbanShowPath(selectedLeadId, nextStage));
      return;
    }
    if (nextStageLeads[0]) {
      navigate(leadKanbanShowPath(nextStageLeads[0].id, nextStage));
      return;
    }
    navigate(leadsKanbanBoardPath());
  };

  const handleStageTransitionCompleted = () => {
    const transition = pendingTransition;
    setStageDialogOpen(false);
    setPendingTransition(null);
    refresh();

    if (transition?.toStage === "won") {
      setConvertCandidate({
        ...transition.lead,
        lead_stage: "won",
      });
    }
  };

  return (
    <LeadKanbanProvider value={kanbanContextValue}>
      <div className="flex h-full min-h-0 flex-col overflow-hidden border-r bg-background">
        <div className="shrink-0 space-y-3 border-b p-3">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-8 w-full justify-start gap-2 px-2 text-muted-foreground"
            onClick={() => navigate(leadsKanbanBoardPath())}
          >
            <LayoutGrid className="size-4" />
            Back to board
          </Button>
          <div className="space-y-1">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Pipeline stage
            </p>
            <LeadStageBreadcrumb
              active={stage}
              counts={counts}
              onSelect={handleStageSelect}
            />
          </div>
          <p className="text-xs text-muted-foreground">
            <span className="font-medium text-foreground">{stageDef.label}</span>
            {" · "}
            {stageLeads.length}{" "}
            {stageLeads.length === 1 ? "lead" : "leads"}
          </p>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain bg-muted/20 p-2">
          {!stageLeads.length ? (
            <p className="px-2 py-8 text-center text-sm text-muted-foreground">
              No leads in this stage.
            </p>
          ) : (
            <div className="flex flex-col gap-1.5">
              {stageLeads.map((lead, index) => (
                <LeadCard
                  key={lead.id}
                  lead={lead}
                  index={index}
                  layout="sidebar"
                  selected={String(lead.id) === selectedLeadId}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      {pendingTransition ? (
        <LeadStageChangeDialog
          lead={pendingTransition.lead}
          toStage={pendingTransition.toStage}
          open={stageDialogOpen}
          onOpenChange={(open) => {
            if (!open) {
              setStageDialogOpen(false);
              setPendingTransition(null);
            }
          }}
          onCompleted={handleStageTransitionCompleted}
        />
      ) : null}

      <ConvertWonLeadDialog
        lead={convertCandidate}
        onClose={() => setConvertCandidate(null)}
        onConverted={(companyId) => {
          setConvertCandidate(null);
          refresh();
          navigate(getClientShowPath(companyId));
        }}
      />
    </LeadKanbanProvider>
  );
};
