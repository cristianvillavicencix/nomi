import { DragDropContext, type OnDragEndResponder } from "@hello-pangea/dnd";
import { useMutation } from "@tanstack/react-query";
import {
  useDataProvider,
  useGetList,
  useListContext,
  useNotify,
  useRefresh,
} from "ra-core";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router";
import { Sparkles } from "lucide-react";

import type { CrmDataProvider } from "@/components/atomic-crm/providers/types";
import type { Contact, OrganizationMember } from "@/components/atomic-crm/types";
import type { Conversation } from "@/modules/types";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

import { getClientShowPath } from "@/app/routing";
import {
  LBS_LEAD_KANBAN_STAGES,
  type LeadStageId,
  normalizeLeadStage,
} from "./leadStages";
import { LeadColumn } from "./LeadColumn";
import { LeadKanbanProvider } from "./LeadKanbanContext";
import { LeadStageChangeDialog } from "./LeadStageChangeDialog";

type LeadsByStage = Record<LeadStageId, Contact[]>;

type PendingStageTransition = {
  lead: Contact;
  fromStage: LeadStageId;
  toStage: LeadStageId;
};

const emptyBuckets = (): LeadsByStage =>
  LBS_LEAD_KANBAN_STAGES.reduce((acc, stage) => {
    acc[stage.id] = [];
    return acc;
  }, {} as LeadsByStage);

const groupLeadsByStage = (leads: Contact[]): LeadsByStage => {
  const buckets = emptyBuckets();
  for (const lead of leads) {
    const stage = normalizeLeadStage(lead.lead_stage);
    buckets[stage].push(lead);
  }
  return buckets;
};

const fullLeadName = (lead: Contact) =>
  `${lead.first_name ?? ""} ${lead.last_name ?? ""}`.trim() ||
  lead.company_name ||
  "this lead";

const SCROLL_EDGE_EPSILON = 2;

const canScrollVertically = (element: HTMLElement, deltaY: number) => {
  if (element.scrollHeight <= element.clientHeight + SCROLL_EDGE_EPSILON) {
    return false;
  }
  if (deltaY > 0) {
    return (
      element.scrollTop + element.clientHeight <
      element.scrollHeight - SCROLL_EDGE_EPSILON
    );
  }
  if (deltaY < 0) {
    return element.scrollTop > SCROLL_EDGE_EPSILON;
  }
  return false;
};

/**
 * Kanban view of leads grouped by `contacts.lead_stage`. Reads from the
 * surrounding `<List resource="contacts">` so filters / search keep
 * working; on drop we open a stage-change dialog (required follow-up
 * fields, note, and optional task) before persisting the move.
 * Dropping a card in "Won" also offers to convert the lead to a client.
 */
export const LeadsKanban = () => {
  const { data, isPending, refetch } = useListContext<Contact>();
  const dataProvider = useDataProvider<CrmDataProvider>();
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
  const boardRef = useRef<HTMLDivElement>(null);

  const { data: members = [] } = useGetList<OrganizationMember>(
    "organization_members",
    {
      pagination: { page: 1, perPage: 100 },
      sort: { field: "first_name", order: "ASC" },
    },
  );

  const { data: clientConversations = [] } = useGetList<Conversation>(
    "conversations",
    {
      pagination: { page: 1, perPage: 500 },
      sort: { field: "last_message_at", order: "DESC" },
      filter: { "type@eq": "client" },
    },
  );

  const kanbanContextValue = useMemo(() => {
    const membersById = Object.fromEntries(
      members.map((member) => [String(member.id), member]),
    );

    const contactIds = new Set((data ?? []).map((lead) => String(lead.id)));
    const conversationsByContactId: Record<string, Conversation> = {};

    for (const conversation of clientConversations) {
      if (conversation.contact_id == null) continue;
      const key = String(conversation.contact_id);
      if (!contactIds.has(key) || conversationsByContactId[key]) continue;
      conversationsByContactId[key] = conversation;
    }

    return { membersById, conversationsByContactId };
  }, [clientConversations, data, members]);

  const handleBoardWheelCapture = useCallback((event: WheelEvent) => {
    const board = boardRef.current;
    if (!board || board.scrollWidth <= board.clientWidth) return;

    const target = event.target as HTMLElement;
    const cards = target.closest(
      "[data-kanban-cards]",
    ) as HTMLElement | null;
    const absX = Math.abs(event.deltaX);
    const absY = Math.abs(event.deltaY);
    const isHorizontalGesture = absX > absY;

    // Trackpad / tilt wheel left-right → pan the board (must be handled here;
    // nested column scroll areas do not bubble horizontal scroll to the board).
    if (isHorizontalGesture) {
      event.preventDefault();
      board.scrollLeft += event.deltaX;
      return;
    }

    // Trackpad / wheel up-down over a tall column → scroll cards vertically.
    if (cards && canScrollVertically(cards, event.deltaY)) {
      return;
    }

    if (cards) {
      // Column top/bottom edge or short column: stop here — stay in the column.
      event.preventDefault();
      return;
    }

    // Vertical wheel on header / gap: board only pans on horizontal gestures.
    event.preventDefault();
  }, []);

  useEffect(() => {
    const board = boardRef.current;
    if (!board) return;

    board.addEventListener("wheel", handleBoardWheelCapture, {
      passive: false,
      capture: true,
    });
    return () => {
      board.removeEventListener("wheel", handleBoardWheelCapture, {
        capture: true,
      });
    };
  }, [handleBoardWheelCapture]);

  useEffect(() => {
    if (data) {
      setLeadsByStage(groupLeadsByStage(data));
    }
  }, [data]);

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

    const sourceStage = source.droppableId as LeadStageId;
    const destStage = destination.droppableId as LeadStageId;
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
    if (revertBoard && pendingTransition && data) {
      setLeadsByStage(groupLeadsByStage(data));
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
    return (
      <div className="rounded-lg border border-dashed bg-muted/30 p-12 text-center text-sm text-muted-foreground">
        No leads match the current filters.
      </div>
    );
  }

  return (
    <>
      <LeadKanbanProvider value={kanbanContextValue}>
        <DragDropContext onDragEnd={onDragEnd}>
          <div
            ref={boardRef}
            className="flex h-full min-h-0 w-full gap-3 overflow-x-auto overscroll-x-contain"
          >
            {LBS_LEAD_KANBAN_STAGES.map((stage) => (
              <LeadColumn
                key={stage.id}
                stage={stage}
                leads={leadsByStage[stage.id]}
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
    </>
  );
};

/**
 * Lightweight version of <ConvertLeadButton> for the Kanban "won" drop
 * flow. The lead has already moved to the "won" column when this opens;
 * accepting also promotes it to a client (and optionally a project).
 * Declining keeps it as a won lead — no harm done.
 */
const ConvertWonLeadDialog = ({
  lead,
  onClose,
  onConverted,
}: {
  lead: Contact | null;
  onClose: () => void;
  onConverted: (companyId: number) => void;
}) => {
  const dataProvider = useDataProvider<CrmDataProvider>();
  const notify = useNotify();
  const [companyName, setCompanyName] = useState("");
  const [createDeal, setCreateDeal] = useState(true);

  const hasExistingCompany = lead?.company_id != null;
  const initialCompanyName = lead?.company_name ?? "";

  useEffect(() => {
    setCompanyName(initialCompanyName);
    setCreateDeal(true);
  }, [initialCompanyName, lead?.id]);

  const { mutate, isPending } = useMutation({
    mutationFn: () => {
      if (!lead) throw new Error("No lead selected");
      const provider = dataProvider as CrmDataProvider & {
        convertLeadToClient: (params: {
          contactId: Contact["id"];
          companyName: string;
          createDeal?: boolean;
        }) => Promise<{
          company_id: number;
          contact_id: number;
          deal_id: number | null;
        }>;
      };
      return provider.convertLeadToClient({
        contactId: lead.id,
        companyName: hasExistingCompany
          ? (lead.company_name ?? companyName)
          : companyName,
        createDeal,
      });
    },
    onSuccess: ({ company_id, deal_id }) => {
      notify(
        deal_id != null
          ? "Lead converted to client and project created"
          : "Lead converted to client",
        { type: "info" },
      );
      onConverted(company_id);
    },
    onError: (error: Error) => {
      notify(error.message || "Failed to convert lead", {
        type: "error",
      });
    },
  });

  const canSubmit = hasExistingCompany ? true : companyName.trim().length >= 2;

  const open = lead != null;

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) onClose();
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="size-5 text-primary" />
            Convert to client?
          </DialogTitle>
          <DialogDescription>
            You moved{" "}
            <span className="font-medium">
              {lead ? fullLeadName(lead) : "this lead"}
            </span>{" "}
            to <span className="font-medium">Won</span>. Promote them to a
            client now?
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          {!hasExistingCompany ? (
            <div className="space-y-2">
              <Label htmlFor="kanban-won-company-name">
                Client company name
              </Label>
              <Input
                id="kanban-won-company-name"
                value={companyName}
                onChange={(event) => setCompanyName(event.target.value)}
                placeholder="Acme Corp"
              />
            </div>
          ) : null}
          <div className="flex items-start gap-2 rounded-md border bg-muted/30 p-3">
            <Checkbox
              id="kanban-won-create-deal"
              checked={createDeal}
              onCheckedChange={(value) => setCreateDeal(value === true)}
            />
            <div className="space-y-1">
              <Label
                htmlFor="kanban-won-create-deal"
                className="cursor-pointer font-medium"
              >
                Also create a project for this client
              </Label>
              <p className="text-xs text-muted-foreground">
                Recommended. The project opens in{" "}
                <span className="font-medium">Closed Won</span> so it shows up
                in Deals right away.
              </p>
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose} disabled={isPending}>
            No, keep as won
          </Button>
          <Button onClick={() => mutate()} disabled={!canSubmit || isPending}>
            {isPending ? "Converting…" : "Yes, convert"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
