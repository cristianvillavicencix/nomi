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
 * Full-view profile shell: identity header on top, then main + related sidebar.
 * Sidebar column is `auto` so a collapsed Related rail stays flush right
 * (a fixed 300px column left empty space beside the w-10 rail).
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
      <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_auto]">
        <div className="min-w-0">{main}</div>
        <div className="justify-self-end">{sidebar}</div>
      </div>
    </div>
  );
};
