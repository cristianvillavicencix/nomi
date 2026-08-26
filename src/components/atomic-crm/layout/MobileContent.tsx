import { type ReactNode } from "react";

/**
 * Mobile page body under fixed MobileHeader.
 * MobileLayout locks the viewport (h-dvh + overflow-hidden); this main must be
 * the single vertical scroller (flex-1 min-h-0 overflow-y-auto) — never min-h-screen.
 */
export const MobileContent = ({ children }: { children: ReactNode }) => (
  <main
    className="mx-auto flex w-full max-w-screen-xl min-h-0 flex-1 flex-col overflow-y-auto overscroll-contain px-4 pt-18 pb-4"
    id="main-content"
  >
    {children}
  </main>
);
