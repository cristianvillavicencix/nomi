import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export const EntityMetaItem = ({
  label,
  children,
  className,
  valueClassName,
}: {
  label: string;
  children: ReactNode;
  className?: string;
  /** Overrides the default single-line truncate on the value. */
  valueClassName?: string;
}) => (
  <div className={cn("min-w-0", className)}>
    <p className="text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
      {label}
    </p>
    <div
      className={cn(
        "mt-0.5 text-sm font-medium text-foreground",
        valueClassName ?? "truncate",
      )}
    >
      {children}
    </div>
  </div>
);

export const EntityMetaRow = ({
  children,
  className,
  columnsClassName = "sm:grid-cols-2 lg:grid-cols-5",
}: {
  children: ReactNode;
  className?: string;
  columnsClassName?: string;
}) => (
  <div
    className={cn(
      "grid gap-4 border-t border-border/60 bg-background/60 px-5 py-3",
      columnsClassName,
      className,
    )}
  >
    {children}
  </div>
);
