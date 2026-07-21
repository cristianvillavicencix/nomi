/** Collapsed icon rail (Tailwind w-11). */
export const TICKET_CONTEXT_RAIL_CLASS = "w-11";

/** Expanded context panel — fixed width, never a % of the thread. */
export const TICKET_CONTEXT_PANEL_CLASS = "w-[22rem]";

/** Overlay panel cap on narrow viewports. */
export const TICKET_CONTEXT_OVERLAY_CLASS = "w-[min(22rem,calc(100vw-3rem))]";

/** Preview sheet width when context rail is collapsed. */
export const TICKET_PREVIEW_SHEET_CLASS = "w-[min(62vw,52rem)]";

/** Preview sheet grows by panel minus rail so the thread keeps the same width. */
export const TICKET_PREVIEW_SHEET_EXPANDED_CLASS =
  "w-[min(92vw,calc(52rem+19.25rem))]";

/** Thread column width inside the preview sheet (sheet width minus rail). */
export const TICKET_PREVIEW_THREAD_CLASS =
  "w-[calc(min(62vw,52rem)-2.75rem)] shrink-0";

export const ticketContextPanelTransition =
  "transition-[width] duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] motion-reduce:transition-none";

export const ticketPreviewSheetTransition =
  "transition-[width] duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] motion-reduce:transition-none";
