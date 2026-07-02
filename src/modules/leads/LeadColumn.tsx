import { Droppable } from "@hello-pangea/dnd";

import type { Contact } from "@/components/atomic-crm/types";
import { cn } from "@/lib/utils";

import { LeadCard } from "./LeadCard";
import type { LeadStageDef } from "./leadStages";

export type LeadColumnProps = {
  stage: LeadStageDef;
  leads: Contact[];
  isDragging?: boolean;
};

export const LeadColumn = ({
  stage,
  leads,
  isDragging = false,
}: LeadColumnProps) => {
  return (
    <div className="flex h-full min-h-0 min-w-[11rem] max-w-[18rem] flex-1 basis-0 flex-col">
      <div
        data-kanban-header
        className="mb-2 flex shrink-0 select-none flex-col items-center text-center"
      >
        <h3 className="flex items-center gap-2 text-sm font-semibold">
          <span
            className="h-2.5 w-2.5 rounded-full"
            style={{ backgroundColor: stage.color }}
          />
          {stage.label}
        </h3>
        <p className="text-[11px] text-muted-foreground">
          {leads.length} {leads.length === 1 ? "lead" : "leads"}
        </p>
      </div>

      <div className="flex min-h-0 flex-1 flex-col">
        <Droppable droppableId={stage.id}>
          {(droppableProvided, snapshot) => (
            <div
              ref={droppableProvided.innerRef}
              {...droppableProvided.droppableProps}
              className="flex min-h-[10rem] flex-1 flex-col"
            >
              <div
                data-kanban-cards
                data-column-scroll
                className={cn(
                  "flex min-h-0 flex-1 flex-col gap-1.5 rounded-xl border bg-muted/20 p-2 transition-colors",
                  isDragging ? "overflow-hidden" : "overflow-y-auto overscroll-y-contain",
                  snapshot.isDraggingOver
                    ? "border-primary/50 bg-primary/5"
                    : "border-transparent",
                )}
              >
                {leads.map((lead, index) => (
                  <LeadCard key={lead.id} lead={lead} index={index} />
                ))}
                {leads.length === 0 ? (
                  <p className="px-2 py-6 text-center text-xs text-muted-foreground">
                    Drop a lead here to move to{" "}
                    <span className="font-medium">{stage.label}</span>
                  </p>
                ) : null}
                {droppableProvided.placeholder}
              </div>
            </div>
          )}
        </Droppable>
      </div>
    </div>
  );
};
