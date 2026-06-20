import { ChevronRight, Circle, Clock } from "lucide-react";
import type { TicketWorkflowStatus } from "@/modules/tickets/ticketStatusWorkflow";
import { cn } from "@/lib/utils";

const STATUS_ITEMS: Array<{
  id: TicketWorkflowStatus;
  label: string;
  activeClass: string;
  icon?: "waiting" | "resolved";
}> = [
  { id: "new", label: "New", activeClass: "text-success" },
  { id: "open", label: "Open", activeClass: "text-success" },
  {
    id: "waiting",
    label: "Waiting",
    activeClass: "text-warning",
    icon: "waiting",
  },
  {
    id: "resolved",
    label: "Resolved",
    activeClass: "text-muted-foreground",
    icon: "resolved",
  },
];

type TicketStatusBreadcrumbProps = {
  active: TicketWorkflowStatus | "all";
  counts: Record<string, number>;
  onSelect: (status: TicketWorkflowStatus) => void;
};

export const TicketStatusBreadcrumb = ({
  active,
  counts,
  onSelect,
}: TicketStatusBreadcrumbProps) => (
  <div className="flex flex-wrap items-center gap-1.5 text-sm">
    {STATUS_ITEMS.map((item, index) => {
      const isActive = active !== "all" && active === item.id;
      return (
        <div key={item.id} className="flex items-center gap-1.5">
          {index > 0 ? (
            <ChevronRight className="size-3.5 shrink-0 text-muted-foreground/70" />
          ) : null}
          <button
            type="button"
            onClick={() => onSelect(item.id)}
            className={cn(
              "inline-flex items-center gap-1 rounded-sm px-0.5 font-medium transition-colors hover:text-foreground",
              isActive ? item.activeClass : "text-muted-foreground",
            )}
          >
            {item.icon === "waiting" ? (
              <Clock className="size-3.5 shrink-0" />
            ) : null}
            {item.icon === "resolved" ? (
              <Circle className="size-3.5 shrink-0" />
            ) : null}
            <span>{item.label}</span>
            {counts[item.id] > 0 ? (
              <span className="text-xs font-normal tabular-nums opacity-80">
                {counts[item.id]}
              </span>
            ) : null}
          </button>
        </div>
      );
    })}
  </div>
);
