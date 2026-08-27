import { type ReactNode } from "react";

/**
 * Mobile page body under fixed MobileHeader.
 * MobileLayout locks the viewport (h-dvh + overflow-hidden); this main must be
 * the single vertical scroller (flex-1 min-h-0 overflow-y-auto) — never min-h-screen.
 */
export const MobileContent = ({ children }: { children: ReactNode }) => (
  <main
    className="mx-auto flex min-h-0 w-full max-w-screen-xl flex-1 flex-col overflow-y-auto overscroll-contain px-4 pt-[calc(3.5rem+env(safe-area-inset-top,0px)+0.75rem)] pb-4"
    id="main-content"
  >
    {children}
  </main>
);
