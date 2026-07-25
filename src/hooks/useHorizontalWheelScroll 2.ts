import { useEffect, type RefObject } from "react";

/**
 * Lets a horizontally-scrolling container (e.g. a kanban board) pan left/right
 * with a normal vertical mouse wheel — even when the pointer is over a column
 * that has its own vertical scroll.
 *
 * Behavior:
 * - Trackpad horizontal gestures (deltaX dominant) are left to the browser.
 * - A vertical wheel over a column marked `data-column-scroll` that can still
 *   scroll in that direction scrolls the column (normal vertical behavior).
 * - Otherwise the vertical delta pans the board horizontally.
 */
export const useHorizontalWheelScroll = (
  ref: RefObject<HTMLElement | null>,
) => {
  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const onWheel = (event: WheelEvent) => {
      // Respect explicit horizontal intent (trackpads send deltaX).
      if (Math.abs(event.deltaX) > Math.abs(event.deltaY)) return;
      if (event.deltaY === 0) return;

      // If hovering a column that can still scroll vertically, let it.
      const columnScroll = (event.target as HTMLElement | null)?.closest?.(
        "[data-column-scroll]",
      ) as HTMLElement | null;
      if (columnScroll) {
        const canScrollUp = columnScroll.scrollTop > 0;
        const canScrollDown =
          columnScroll.scrollTop + columnScroll.clientHeight <
          columnScroll.scrollHeight - 1;
        if (
          (event.deltaY < 0 && canScrollUp) ||
          (event.deltaY > 0 && canScrollDown)
        ) {
          return;
        }
      }

      // Nothing to pan horizontally.
      if (el.scrollWidth <= el.clientWidth) return;

      event.preventDefault();
      el.scrollLeft += event.deltaY;
    };

    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [ref]);
};
