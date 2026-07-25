import { useEffect, type RefObject } from "react";

const VIEWPORT_EDGE_PX = 88;
const MAX_SCROLL_STEP_PX = 28;

/**
 * While dragging a kanban card, pan a horizontally scrollable board when the
 * pointer nears the viewport edge so off-screen columns stay reachable.
 *
 * hello-pangea/dnd measures droppable positions in viewport space; if the board
 * does not scroll during drag, drops land on the wrong column.
 */
export const useKanbanEdgeAutoScroll = (
  boardRef: RefObject<HTMLElement | null>,
  isDragging: boolean,
) => {
  useEffect(() => {
    if (!isDragging) return;

    let pointerX = window.innerWidth / 2;
    let frameId = 0;

    const onPointerMove = (event: MouseEvent | TouchEvent) => {
      pointerX =
        "touches" in event
          ? (event.touches[0]?.clientX ?? pointerX)
          : event.clientX;
    };

    const tick = () => {
      const board = boardRef.current;
      if (board && board.scrollWidth > board.clientWidth + 1) {
        const maxScroll = board.scrollWidth - board.clientWidth;
        const distanceRight = window.innerWidth - pointerX;
        const distanceLeft = pointerX;

        if (distanceRight < VIEWPORT_EDGE_PX) {
          const intensity = 1 - distanceRight / VIEWPORT_EDGE_PX;
          board.scrollLeft = Math.min(
            maxScroll,
            board.scrollLeft + Math.ceil(MAX_SCROLL_STEP_PX * intensity),
          );
        } else if (distanceLeft < VIEWPORT_EDGE_PX) {
          const intensity = 1 - distanceLeft / VIEWPORT_EDGE_PX;
          board.scrollLeft = Math.max(
            0,
            board.scrollLeft - Math.ceil(MAX_SCROLL_STEP_PX * intensity),
          );
        }
      }
      frameId = window.requestAnimationFrame(tick);
    };

    document.addEventListener("mousemove", onPointerMove, { passive: true });
    document.addEventListener("touchmove", onPointerMove, { passive: true });
    frameId = window.requestAnimationFrame(tick);

    return () => {
      window.cancelAnimationFrame(frameId);
      document.removeEventListener("mousemove", onPointerMove);
      document.removeEventListener("touchmove", onPointerMove);
    };
  }, [boardRef, isDragging]);
};
