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
  trailingContainerEl: HTMLElement | null;
  setTrailingContainerEl: (el: HTMLElement | null) => void;
};

const PageActionsContext = createContext<PageActionsContextValue | null>(null);

export const PageActionsProvider = ({ children }: { children: ReactNode }) => {
  const [containerEl, setContainerEl] = useState<HTMLElement | null>(null);
  const [trailingContainerEl, setTrailingContainerEl] =
    useState<HTMLElement | null>(null);
  return (
    <PageActionsContext.Provider
      value={{
        containerEl,
        setContainerEl,
        trailingContainerEl,
        setTrailingContainerEl,
      }}
    >
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

/** Right side of the header, after the search bar (e.g. show-page ⋮ menu). */
export const PageActionsTrailingSlot = ({
  className,
}: {
  className?: string;
}) => {
  const ctx = useContext(PageActionsContext);
  if (!ctx) {
    throw new Error(
      "PageActionsTrailingSlot must be used inside a <PageActionsProvider>",
    );
  }
  return (
    <div
      ref={(el) => ctx.setTrailingContainerEl(el)}
      data-slot="page-actions-trailing"
      className={className}
    />
  );
};

export const PageActionsTrailing = ({ children }: { children: ReactNode }) => {
  const ctx = useContext(PageActionsContext);
  const [, setReady] = useState(0);
  useEffect(() => {
    if (!ctx?.trailingContainerEl) {
      setReady((n) => n + 1);
    }
  }, [ctx?.trailingContainerEl]);

  if (!ctx) return <>{children}</>;
  if (!ctx.trailingContainerEl) return null;
  return createPortal(children, ctx.trailingContainerEl);
};

/**
 * Tiny header label used inside <PageActions> — e.g. "Leads".
 * Prefer list totals in `ModuleSearchField` placeholders, not here.
 * Pass `count` only for rare explicit cases (not list directory totals).
 */
export const PageTitle = ({
  label,
  count,
}: {
  label: string;
  /** Only shown when explicitly passed — do not use for list totals (put those in ModuleSearchField). */
  count?: number | null;
}) => {
  return (
    <h1 className="mr-2 flex items-baseline gap-1.5 whitespace-nowrap text-2xl font-semibold tracking-tight max-md:px-4 max-md:pt-3 md:mr-2 md:px-0 md:pt-0 md:text-sm md:tracking-normal">
      <span>{label}</span>
      {count != null ? (
        <span className="text-xs font-normal text-muted-foreground tabular-nums">
          ({count.toLocaleString()})
        </span>
      ) : null}
    </h1>
  );
};

/**
 * Responsive label for header toolbar controls (PageActions).
 *
 * Pattern: keep a single horizontal row (slot scrolls); collapse text so
 * icon+aria-label remain on narrow viewports.
 * - `primary` (create CTAs): label from `sm` up
 * - `secondary` (filters, view toggles): label from `md` up
 */
export const ToolbarLabel = ({
  children,
  priority = "secondary",
}: {
  children: ReactNode;
  priority?: "primary" | "secondary";
}) => (
  <span
    className={
      priority === "primary" ? "hidden sm:inline" : "hidden md:inline"
    }
  >
    {children}
  </span>
);

/** Cluster of actions on the right side of PageActions — never wrap. */
export const PAGE_ACTIONS_CLUSTER =
  "ml-auto flex shrink-0 flex-nowrap items-center gap-2";

