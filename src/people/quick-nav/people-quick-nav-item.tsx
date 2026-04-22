import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { PeopleQuickNavItem as QuickItem } from "./types";

export const PeopleQuickNavItem = ({
  item,
  active,
  onSelect,
  secondaryLine,
}: {
  item: QuickItem;
  active: boolean;
  onSelect: (id: string) => void;
  secondaryLine?: string;
}) => (
  <button
    type="button"
    aria-selected={active}
    className={cn(
      "w-full rounded-md border px-2.5 py-2 text-left text-sm transition-colors hover:bg-muted/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
      active && "border-primary/40 bg-secondary/60",
    )}
    onClick={() => onSelect(item.id)}
  >
    <div className="flex items-start justify-between gap-2">
      <div className="min-w-0">
        <div className="font-medium truncate">{item.displayName}</div>
        <div className="truncate text-xs text-muted-foreground">
          {secondaryLine || item.email || item.phone || "No contact info"}
        </div>
      </div>
      <Badge variant={item.status === "active" ? "outline" : "secondary"}>
        {item.status}
      </Badge>
    </div>
  </button>
);

