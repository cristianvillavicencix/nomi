import { Droppable } from "@hello-pangea/dnd";

import type { Contact } from "@/components/atomic-crm/types";
import { cn } from "@/lib/utils";

import { LeadCard } from "./LeadCard";
import type { LeadStageDef } from "./leadStages";

export type LeadColumnProps = {
  stage: LeadStageDef;
  leads: Contact[];
};

const COLUMN_MAX_HEIGHT = "calc(100vh - 16rem)";

export const LeadColumn = ({ stage, leads }: LeadColumnProps) => {
  return (
    <div className="flex w-[280px] shrink-0 flex-col pb-6">
      <div className="mb-2 flex flex-col items-center text-center">
        <h3 className="flex items-center gap-2 text-sm font-semibold">
          <span
            className="h-2.5 w-2.5 rounded-full"
            style={{ backgroundColor: stage.color }}
          />
          {stage.label}
          {stage.terminal ? (
            <span className="rounded-sm bg-muted px-1.5 py-0.5 text-[10px] font-normal uppercase tracking-wide text-muted-foreground">
              terminal
            </span>
          ) : null}
        </h3>
        <p className="text-[11px] text-muted-foreground">
          {leads.length} {leads.length === 1 ? "lead" : "leads"}
        </p>
      </div>

      <Droppable droppableId={stage.id}>
        {(droppableProvided, snapshot) => (
          <div
            ref={droppableProvided.innerRef}
            {...droppableProvided.droppableProps}
            className={cn(
              "flex flex-1 flex-col gap-2 overflow-y-auto rounded-xl border bg-muted/20 p-2 transition-colors",
              snapshot.isDraggingOver
                ? "border-primary/50 bg-primary/5"
                : "border-transparent",
            )}
            style={{ maxHeight: COLUMN_MAX_HEIGHT }}
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
        )}
      </Droppable>
    </div>
  );
};
