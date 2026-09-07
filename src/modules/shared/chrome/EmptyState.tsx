import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export const EmptyState = ({
  icon,
  title,
  description,
  action,
  className,
}: {
  icon?: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
}) => (
  <div
    className={cn(
      "flex flex-col items-center justify-center gap-3 px-6 py-10 text-center",
      className,
    )}
  >
    {icon}
    <div className="space-y-1">
      <p className="text-sm font-medium text-foreground">{title}</p>
      {description ? (
        <p className="max-w-sm text-sm text-muted-foreground">{description}</p>
      ) : null}
    </div>
    {action}
  </div>
);
