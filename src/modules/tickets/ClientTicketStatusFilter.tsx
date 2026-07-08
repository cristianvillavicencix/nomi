import { ChevronRight, Circle, Clock } from "lucide-react";
import type { TicketStatusFilterId } from "@/modules/tickets/ticketInboxConfig";
import { cn } from "@/lib/utils";

const FILTER_ITEMS: Array<{
  id: TicketStatusFilterId;
  label: string;
  activeClass: string;
  icon?: "waiting" | "resolved";
}> = [
  {
    id: "all",
    label: "All",
    activeClass:
      "bg-foreground/10 text-foreground ring-1 ring-border dark:text-foreground",
  },
  {
    id: "new",
    label: "New",
    activeClass:
      "bg-emerald-500/15 text-emerald-800 ring-1 ring-emerald-500/25 dark:text-emerald-300",
  },
  {
    id: "open",
    label: "Open",
    activeClass:
      "bg-sky-500/15 text-sky-800 ring-1 ring-sky-500/25 dark:text-sky-300",
  },
  {
    id: "waiting",
    label: "Waiting",
    activeClass:
      "bg-amber-500/15 text-amber-900 ring-1 ring-amber-500/25 dark:text-amber-300",
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

type ClientTicketStatusFilterProps = {
  active: TicketStatusFilterId;
  counts: Record<TicketStatusFilterId, number>;
  onSelect: (status: TicketStatusFilterId) => void;
};

export const ClientTicketStatusFilter = ({
  active,
  counts,
  onSelect,
}: ClientTicketStatusFilterProps) => (
  <div className="flex flex-nowrap items-center gap-0.5 overflow-x-auto text-sm [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
    {FILTER_ITEMS.map((item, index) => {
      const isActive = active === item.id;
      const count = counts[item.id] ?? 0;

      return (
        <div key={item.id} className="flex shrink-0 items-center gap-0.5">
          {index > 0 ? (
            <ChevronRight className="size-3 shrink-0 text-muted-foreground/45" />
          ) : null}
          <button
            type="button"
            onClick={() => onSelect(item.id)}
            aria-current={isActive ? "page" : undefined}
            className={cn(
              "inline-flex shrink-0 items-center gap-1 whitespace-nowrap rounded px-1.5 py-0.5 text-sm transition-colors",
              isActive
                ? cn(item.activeClass, "font-semibold")
                : "font-medium text-muted-foreground hover:bg-muted/50 hover:text-foreground",
            )}
          >
            {item.icon === "waiting" ? (
              <Clock className="size-3 shrink-0" />
            ) : null}
            {item.icon === "resolved" ? (
              <Circle className="size-3 shrink-0" />
            ) : null}
            <span>{item.label}</span>
            {count > 0 ? (
              <span className="tabular-nums opacity-90">{count}</span>
            ) : null}
          </button>
        </div>
      );
    })}
  </div>
);
