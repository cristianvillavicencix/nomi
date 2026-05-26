import { DragDropContext, type OnDragEndResponder } from "@hello-pangea/dnd";
import { useDataProvider, useListContext, useNotify } from "ra-core";
import { useEffect, useMemo, useState } from "react";

import type { Contact } from "@/components/atomic-crm/types";

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

/**
 * Kanban view of leads grouped by `contacts.lead_stage`. Reads from the
 * surrounding `<List resource="contacts">` so filters / search keep
 * working; on drop we patch the contact's stage (and freeze/unfreeze the
 * anti-olvido `snooze_until` when entering or leaving a terminal column).
 */
export const LeadsKanban = () => {
  const { data, isPending, refetch } = useListContext<Contact>();
  const dataProvider = useDataProvider();
  const notify = useNotify();
  const [leadsByStage, setLeadsByStage] = useState<LeadsByStage>(emptyBuckets);

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
        },
        previousData: moved,
      })
      .then(() => {
        notify(`Lead movido a "${destStage}"`, { type: "info" });
        refetch();
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
  );
};
