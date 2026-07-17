import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

type ProfileFullViewLayoutProps = {
  header: ReactNode;
  main: ReactNode;
  sidebar?: ReactNode;
  /** Stack sidebar under main (mobile). */
  stacked?: boolean;
  className?: string;
};

/**
 * Full-view profile shell: identity header on top, then main (~70%) + related sidebar (~30%).
 */
export const ProfileFullViewLayout = ({
  header,
  main,
  sidebar,
  stacked = false,
  className,
}: ProfileFullViewLayoutProps) => {
  if (stacked || !sidebar) {
    return (
      <div className={cn("space-y-4", className)}>
        {header}
        <div className="min-w-0">{main}</div>
        {sidebar}
      </div>
    );
  }

  return (
    <div className={cn("space-y-4", className)}>
      {header}
      <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_300px]">
        <div className="min-w-0">{main}</div>
        {sidebar}
      </div>
    </div>
  );
};
