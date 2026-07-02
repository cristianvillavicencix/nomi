import { ChevronRight, Circle, Clock } from "lucide-react";
import type { TicketWorkflowStatus } from "@/modules/tickets/ticketStatusWorkflow";
import { cn } from "@/lib/utils";

const STATUS_ITEMS: Array<{
  id: TicketWorkflowStatus;
  label: string;
  activeClass: string;
  icon?: "waiting" | "resolved";
}> = [
  {
    id: "new",
    label: "New",
    activeClass:
      "bg-emerald-500/15 text-emerald-800 ring-1 ring-emerald-500/30 dark:text-emerald-300",
  },
  {
    id: "open",
    label: "Open",
    activeClass:
      "bg-sky-500/15 text-sky-800 ring-1 ring-sky-500/30 dark:text-sky-300",
  },
  {
    id: "waiting",
    label: "Waiting",
    activeClass:
      "bg-amber-500/15 text-amber-900 ring-1 ring-amber-500/30 dark:text-amber-300",
    icon: "waiting",
  },
  {
    id: "resolved",
    label: "Resolved",
    activeClass:
      "bg-muted text-foreground ring-1 ring-border dark:text-foreground",
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
  <div className="flex flex-wrap items-center gap-1 text-sm">
    {STATUS_ITEMS.map((item, index) => {
      const isActive = active !== "all" && active === item.id;
      const count = counts[item.id] ?? 0;

      return (
        <div key={item.id} className="flex items-center gap-1">
          {index > 0 ? (
            <ChevronRight className="size-3.5 shrink-0 text-muted-foreground/50" />
          ) : null}
          <button
            type="button"
            onClick={() => onSelect(item.id)}
            aria-current={isActive ? "page" : undefined}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 font-medium transition-all",
              isActive
                ? cn(item.activeClass, "text-base font-semibold shadow-sm")
                : "text-muted-foreground hover:bg-muted/60 hover:text-foreground",
            )}
          >
            {item.icon === "waiting" ? (
              <Clock className={cn("shrink-0", isActive ? "size-4" : "size-3.5")} />
            ) : null}
            {item.icon === "resolved" ? (
              <Circle className={cn("shrink-0", isActive ? "size-4" : "size-3.5")} />
            ) : null}
            <span>{item.label}</span>
            {count > 0 ? (
              <span
                className={cn(
                  "tabular-nums",
                  isActive
                    ? "text-sm font-semibold"
                    : "text-xs font-normal opacity-80",
                )}
              >
                {count}
              </span>
            ) : null}
          </button>
        </div>
      );
    })}
  </div>
);
