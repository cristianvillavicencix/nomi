import { ChevronDown, type LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

type CollapsibleToolsSectionProps = {
  title: string;
  icon?: LucideIcon;
  expanded: boolean;
  onExpandedChange: (expanded: boolean) => void;
  titleAddon?: ReactNode;
  headerAddon?: ReactNode;
  children: ReactNode;
  className?: string;
  contentClassName?: string;
};

export const CollapsibleToolsSection = ({
  title,
  icon: Icon,
  expanded,
  onExpandedChange,
  titleAddon,
  headerAddon,
  children,
  className,
  contentClassName,
}: CollapsibleToolsSectionProps) => (
  <section
    className={cn(
      "flex flex-col border-b border-border/70 last:border-b-0",
      className,
    )}
  >
    <div className="flex items-center gap-2 px-4 py-3">
      <button
        type="button"
        className="flex min-w-0 flex-1 items-center gap-2 text-left"
        onClick={() => onExpandedChange(!expanded)}
        aria-expanded={expanded}
        aria-label={`${expanded ? "Collapse" : "Expand"} ${title}`}
      >
        <ChevronDown
          className={cn(
            "size-4 shrink-0 text-muted-foreground transition-transform",
            !expanded && "-rotate-90",
          )}
        />
        {Icon ? (
          <Icon className="size-4 shrink-0 text-muted-foreground" />
        ) : null}
        <span className="text-sm font-medium">{title}</span>
      </button>
      {titleAddon}
      {headerAddon}
    </div>
    {expanded ? (
      <div className={cn("min-h-0", contentClassName)}>{children}</div>
    ) : null}
  </section>
);
