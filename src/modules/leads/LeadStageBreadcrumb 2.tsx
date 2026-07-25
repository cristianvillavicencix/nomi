import { ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  LBS_LEAD_KANBAN_BOARD_STAGES,
  type LeadStageId,
} from "@/modules/leads/leadStages";

type LeadStageBreadcrumbProps = {
  active: LeadStageId;
  counts: Partial<Record<LeadStageId, number>>;
  onSelect: (stage: LeadStageId) => void;
};

export const LeadStageBreadcrumb = ({
  active,
  counts,
  onSelect,
}: LeadStageBreadcrumbProps) => (
  <div className="flex flex-nowrap items-center gap-0.5 overflow-x-auto text-sm [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
    {LBS_LEAD_KANBAN_BOARD_STAGES.map((stage, index) => {
      const isActive = active === stage.id;
      const count = counts[stage.id] ?? 0;

      return (
        <div key={stage.id} className="flex shrink-0 items-center gap-0.5">
          {index > 0 ? (
            <ChevronRight className="size-3 shrink-0 text-muted-foreground/45" />
          ) : null}
          <button
            type="button"
            onClick={() => onSelect(stage.id)}
            aria-current={isActive ? "page" : undefined}
            className={cn(
              "inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded px-1.5 py-0.5 text-sm transition-colors",
              isActive
                ? "font-semibold ring-1 ring-inset"
                : "font-medium text-muted-foreground hover:bg-muted/50 hover:text-foreground",
            )}
            style={
              isActive
                ? {
                    color: stage.color,
                    backgroundColor: `${stage.color}18`,
                    boxShadow: `inset 0 0 0 1px ${stage.color}40`,
                  }
                : undefined
            }
          >
            <span
              className="size-2 shrink-0 rounded-full"
              style={{ backgroundColor: stage.color }}
              aria-hidden
            />
            <span>{stage.label}</span>
            {count > 0 ? (
              <span className="tabular-nums opacity-90">{count}</span>
            ) : null}
          </button>
        </div>
      );
    })}
  </div>
);
