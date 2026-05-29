import { DragDropContext, type OnDragEndResponder } from "@hello-pangea/dnd";
import { useMutation } from "@tanstack/react-query";
import {
  useDataProvider,
  useListContext,
  useNotify,
  useRefresh,
} from "ra-core";
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router";
import { Sparkles } from "lucide-react";

import type { CrmDataProvider } from "@/components/atomic-crm/providers/types";
import type { Contact } from "@/components/atomic-crm/types";
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

import { LBS_CLIENT_STATUS } from "@/lbs/navigation";
import {
  LBS_LEAD_KANBAN_STAGES,
  type LeadStageId,
  normalizeLeadStage,
} from "./leadStages";
import { LeadColumn } from "./LeadColumn";

type LeadsByStage = Record<LeadStageId, Contact[]>;

const FROZEN_SNOOZE = "2099-12-31T00:00:00+00:00";

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
  "este lead";

/**
 * Kanban view of leads grouped by `contacts.lead_stage`. Reads from the
 * surrounding `<List resource="contacts">` so filters / search keep
 * working; on drop we patch the contact's stage (and freeze/unfreeze the
 * anti-olvido `snooze_until` when entering or leaving a terminal column).
 * Dropping a card in "Ganado" also offers to convert the lead to a
 * client right then and there.
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
    const sourceList = [...leadsByStage[sourceStage]];
    const [moved] = sourceList.splice(source.index, 1);
    if (!moved) return;

    const previousState = leadsByStage;

    const movedUpdated: Contact = {
      ...moved,
      lead_stage: destStage,
      snooze_until:
        destStage === "won" || destStage === "lost"
          ? FROZEN_SNOOZE
          : sourceStage === "won" || sourceStage === "lost"
            ? null
            : (moved.snooze_until ?? null),
    };

    const destList = [...leadsByStage[destStage]];
    destList.splice(destination.index, 0, movedUpdated);

    const optimistic: LeadsByStage = {
      ...leadsByStage,
      [sourceStage]: sourceList,
      [destStage]: destList,
    };
    setLeadsByStage(optimistic);

    void dataProvider
      .update("contacts", {
        id: moved.id,
        data: {
          lead_stage: destStage,
          snooze_until: movedUpdated.snooze_until ?? null,
          ...(promoteToClient ? { status: LBS_CLIENT_STATUS } : {}),
        },
        previousData: moved,
      })
      .then(() => {
        refetch();
        if (
          destStage === "won" &&
          sourceStage !== "won" &&
          !promoteToClient
        ) {
          // Offer the natural next step without forcing it.
          setConvertCandidate(movedUpdated);
        } else if (promoteToClient) {
          notify("Lead promovido a cliente", { type: "success" });
          refresh();
        } else {
          notify(`Lead movido a "${destStage}"`, { type: "info" });
        }
      })
      .catch((error: unknown) => {
        setLeadsByStage(previousState);
        const message =
          error instanceof Error ? error.message : "No se pudo mover el lead";
        notify(message, { type: "error" });
      });
  };

  if (isPending) return null;

  if (totalCount === 0) {
    return (
      <div className="rounded-lg border border-dashed bg-muted/30 p-12 text-center text-sm text-muted-foreground">
        No hay leads que coincidan con los filtros actuales.
      </div>
    );
  }

  return (
    <>
      <DragDropContext onDragEnd={onDragEnd}>
        <div className="flex w-full gap-3 overflow-x-auto pb-3">
          {LBS_LEAD_KANBAN_STAGES.map((stage) => (
            <LeadColumn
              key={stage.id}
              stage={stage}
              leads={leadsByStage[stage.id]}
            />
          ))}
        </div>
      </DragDropContext>
      <ConvertWonLeadDialog
        lead={convertCandidate}
        onClose={() => setConvertCandidate(null)}
        onConverted={(companyId) => {
          setConvertCandidate(null);
          refresh();
          navigate(`/clients/${companyId}/show`);
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
          ? "Lead convertido a cliente y proyecto creado"
          : "Lead convertido a cliente",
        { type: "info" },
      );
      onConverted(company_id);
    },
    onError: (error: Error) => {
      notify(error.message || "No se pudo convertir el lead", {
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
            ¿Convertir a cliente?
          </DialogTitle>
          <DialogDescription>
            Acabas de mover{" "}
            <span className="font-medium">
              {lead ? fullLeadName(lead) : "este lead"}
            </span>{" "}
            a <span className="font-medium">Ganado</span>. ¿Quieres promoverlo a
            cliente ahora?
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          {!hasExistingCompany ? (
            <div className="space-y-2">
              <Label htmlFor="kanban-won-company-name">
                Nombre de la empresa cliente
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
                Crear también un proyecto para este cliente
              </Label>
              <p className="text-xs text-muted-foreground">
                Recomendado. El proyecto se abre en{" "}
                <span className="font-medium">Closed Won</span> para que ya
                aparezca en Deals.
              </p>
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose} disabled={isPending}>
            No, dejarlo como ganado
          </Button>
          <Button onClick={() => mutate()} disabled={!canSubmit || isPending}>
            {isPending ? "Convirtiendo…" : "Sí, convertir"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
