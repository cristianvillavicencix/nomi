import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";

/**
 * Two-piece portal that lets list pages "teleport" their toolbar buttons
 * into the global top bar that lives in `SidebarLayout`.
 *
 * Usage:
 *   1. Layout wraps everything in <PageActionsProvider>
 *   2. Layout renders <PageActionsSlot /> wherever the buttons should land
 *   3. Each page renders <PageActions>{buttons}</PageActions>
 */

type PageActionsContextValue = {
  containerEl: HTMLElement | null;
  setContainerEl: (el: HTMLElement | null) => void;
};

const PageActionsContext = createContext<PageActionsContextValue | null>(null);

export const PageActionsProvider = ({ children }: { children: ReactNode }) => {
  const [containerEl, setContainerEl] = useState<HTMLElement | null>(null);
  return (
    <PageActionsContext.Provider value={{ containerEl, setContainerEl }}>
      {children}
    </PageActionsContext.Provider>
  );
};

/** Mount once in the layout: this is where teleported children land. */
export const PageActionsSlot = ({ className }: { className?: string }) => {
  const ctx = useContext(PageActionsContext);
  if (!ctx) {
    throw new Error(
      "PageActionsSlot must be used inside a <PageActionsProvider>",
    );
  }
  return (
    <div
      ref={(el) => ctx.setContainerEl(el)}
      data-slot="page-actions"
      className={className}
    />
  );
};

/**
 * Render-once placeholder: pages use this in place of <TopToolbar>.
 * Children are portaled into the slot via React's `createPortal`.
 *
 * If used outside the provider (e.g. on a show page that doesn't yet
 * adopt the new layout), the children render inline as a fallback so we
 * don't accidentally drop the actions.
 */
export const PageActions = ({ children }: { children: ReactNode }) => {
  const ctx = useContext(PageActionsContext);
  // Force a re-render once the slot mounts/unmounts so the portal target
  // becomes available even when this component mounts before the slot.
  const [, setReady] = useState(0);
  useEffect(() => {
    if (!ctx?.containerEl) {
      setReady((n) => n + 1);
    }
  }, [ctx?.containerEl]);

  if (!ctx) return <>{children}</>;
  if (!ctx.containerEl) return null;
  return createPortal(children, ctx.containerEl);
};
