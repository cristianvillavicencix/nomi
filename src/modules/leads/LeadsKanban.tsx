import { DragDropContext, type OnDragEndResponder } from "@hello-pangea/dnd";
import {
  useListContext,
  useNotify,
  useRefresh,
} from "ra-core";
import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router";

import { useHorizontalWheelScroll } from "@/hooks/useHorizontalWheelScroll";
import { useKanbanEdgeAutoScroll } from "@/hooks/useKanbanEdgeAutoScroll";

import type { Contact } from "@/components/atomic-crm/types";
import { getClientShowPath } from "@/app/routing";
import {
  LBS_LEAD_KANBAN_BOARD_STAGES,
  type LeadStageId,
  normalizeLeadStage,
} from "./leadStages";
import { ConvertWonLeadDialog } from "./ConvertWonLeadDialog";
import { LeadColumn } from "./LeadColumn";
import { LeadKanbanProvider } from "./LeadKanbanContext";
import { isLeadTerminalStage } from "./leadFollowUpUtils";
import { LeadStageChangeDialog } from "./LeadStageChangeDialog";
import { useLeadKanbanEnrichment } from "./useLeadKanbanEnrichment";

type BoardStageId = (typeof LBS_LEAD_KANBAN_BOARD_STAGES)[number]["id"];
type LeadsByStage = Record<BoardStageId, Contact[]>;

type PendingStageTransition = {
  lead: Contact;
  fromStage: LeadStageId;
  toStage: LeadStageId;
};

const emptyBuckets = (): LeadsByStage =>
  LBS_LEAD_KANBAN_BOARD_STAGES.reduce((acc, stage) => {
    acc[stage.id] = [];
    return acc;
  }, {} as LeadsByStage);

const groupLeadsByStage = (leads: Contact[]): LeadsByStage => {
  const buckets = emptyBuckets();
  for (const lead of leads) {
    if (isLeadTerminalStage(lead.lead_stage)) continue;
    const stage = normalizeLeadStage(lead.lead_stage) as BoardStageId;
    if (stage in buckets) {
      buckets[stage].push(lead);
    }
  }
  return buckets;
};

/**
 * Kanban view of leads grouped by `contacts.lead_stage`. Reads from the
 * surrounding `<List resource="contacts">` so filters / search keep
 * working; on drop we open a stage-change dialog (required follow-up
 * fields, note, and optional task) before persisting the move.
 * Won/Lost are button actions on each card (not Kanban columns).
 * Dropping a card in "Won" also offers to convert the lead to a client.
 */
export const LeadsKanban = () => {
  const { data, isPending, refetch } = useListContext<Contact>();
  const notify = useNotify();
  const refresh = useRefresh();
  const navigate = useNavigate();
  const [leadsByStage, setLeadsByStage] = useState<LeadsByStage>(emptyBuckets);
  const [convertCandidate, setConvertCandidate] = useState<Contact | null>(
    null,
  );
  const [pendingTransition, setPendingTransition] =
    useState<PendingStageTransition | null>(null);
  const [stageDialogOpen, setStageDialogOpen] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const boardRef = useRef<HTMLDivElement>(null);
  useHorizontalWheelScroll(boardRef);
  useKanbanEdgeAutoScroll(boardRef, isDragging);

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
  const closedLeadCount = (data?.length ?? 0) - activeLeads.length;

  useEffect(() => {
    if (activeLeads.length > 0) {
      setLeadsByStage(groupLeadsByStage(activeLeads));
    } else {
      setLeadsByStage(emptyBuckets());
    }
  }, [activeLeads]);

  const totalCount = useMemo(
    () =>
      Object.values(leadsByStage).reduce((acc, list) => acc + list.length, 0),
    [leadsByStage],
  );

  const onDragEnd: OnDragEndResponder = (result) => {
    const { destination, source } = result;
    if (!destination) return;
    if (
      destination.droppableId === source.droppableId &&
      destination.index === source.index
    ) {
      return;
    }

    const sourceStage = source.droppableId as BoardStageId;
    const destStage = destination.droppableId as BoardStageId;
    if (sourceStage === destStage) return;

    const sourceList = leadsByStage[sourceStage];
    const moved = sourceList[source.index];
    if (!moved) return;

    setLeadsByStage((current) => {
      const nextSource = [...current[sourceStage]];
      const [item] = nextSource.splice(source.index, 1);
      const nextDest = [...current[destStage]];
      nextDest.splice(destination.index, 0, item);
      return {
        ...current,
        [sourceStage]: nextSource,
        [destStage]: nextDest,
      };
    });

    setPendingTransition({
      lead: moved,
      fromStage: sourceStage,
      toStage: destStage,
    });
    setStageDialogOpen(true);
  };

  const closeStageDialog = (revertBoard = true) => {
    setStageDialogOpen(false);
    if (revertBoard && pendingTransition && activeLeads.length > 0) {
      setLeadsByStage(groupLeadsByStage(activeLeads));
    } else if (revertBoard) {
      setLeadsByStage(emptyBuckets());
    }
    setPendingTransition(null);
  };

  const handleStageTransitionCompleted = () => {
    const transition = pendingTransition;
    setStageDialogOpen(false);
    setPendingTransition(null);
    void refetch();

    if (transition?.toStage === "won") {
      setConvertCandidate({
        ...transition.lead,
        lead_stage: "won",
      });
    }
  };

  if (isPending) return null;

  if (totalCount === 0) {
    if (closedLeadCount > 0) {
      return (
        <div className="rounded-lg border border-dashed bg-muted/30 p-12 text-center text-sm text-muted-foreground">
          No active pipeline leads.{" "}
          <span className="font-medium text-foreground">
            {closedLeadCount} won or lost
          </span>{" "}
          — switch to Table view to see them.
        </div>
      );
    }

    return (
      <div className="rounded-lg border border-dashed bg-muted/30 p-12 text-center text-sm text-muted-foreground">
        No leads match the current filters.
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <LeadKanbanProvider value={kanbanContextValue}>
        <DragDropContext
          onDragStart={() => setIsDragging(true)}
          onDragEnd={(result) => {
            setIsDragging(false);
            onDragEnd(result);
          }}
        >
          <div
            ref={boardRef}
            className="flex min-h-0 w-full flex-1 gap-2 overflow-x-auto overscroll-x-contain pb-2"
          >
            {LBS_LEAD_KANBAN_BOARD_STAGES.map((stage) => (
              <LeadColumn
                key={stage.id}
                stage={stage}
                leads={leadsByStage[stage.id]}
                isDragging={isDragging}
              />
            ))}
          </div>
        </DragDropContext>
      </LeadKanbanProvider>

      {pendingTransition ? (
        <LeadStageChangeDialog
          lead={pendingTransition.lead}
          toStage={pendingTransition.toStage}
          open={stageDialogOpen}
          onOpenChange={(open) => {
            if (!open) closeStageDialog(true);
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
    </div>
  );
};
