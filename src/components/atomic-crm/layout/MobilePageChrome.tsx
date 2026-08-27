import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * iOS-style mobile hub chrome: left large title, trailing action, search, inset list.
 * The scroller extends under the floating glass tab bar.
 */
export const MobilePageChrome = ({
  title,
  action,
  search,
  children,
  className,
}: {
  title: string;
  action?: ReactNode;
  search?: ReactNode;
  children: ReactNode;
  className?: string;
}) => (
  <div className={cn("flex min-h-0 flex-1 flex-col", className)}>
    <header className="glass-header sticky top-0 z-20 shrink-0 pt-[env(safe-area-inset-top,0px)]">
      <div className="flex items-center gap-3 px-4 pt-2 pb-1">
        <h1 className="min-w-0 flex-1 text-[1.75rem] font-bold leading-tight tracking-tight">
          {title}
        </h1>
        {action ? <div className="shrink-0">{action}</div> : null}
      </div>
      {search ? <div className="px-4 pt-1 pb-3">{search}</div> : null}
    </header>
    <div className="min-h-0 flex-1 mobile-scroll px-4 pb-mobile-dock">
      {children}
    </div>
  </div>
);
