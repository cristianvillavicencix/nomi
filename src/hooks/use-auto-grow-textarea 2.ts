import { useLayoutEffect, type RefObject } from "react";

type UseAutoGrowTextareaOptions = {
  minHeight?: number;
  maxHeight?: number;
  /** Re-run height sync when this value changes (e.g. composer open). */
  resizeTrigger?: unknown;
};

export const useAutoGrowTextarea = (
  ref: RefObject<HTMLElement | null>,
  value: string,
  {
    minHeight = 160,
    maxHeight = 720,
    resizeTrigger,
  }: UseAutoGrowTextareaOptions = {},
) => {
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;

    el.style.height = "0px";
    const contentHeight = el.scrollHeight;
    const next = Math.min(Math.max(contentHeight, minHeight), maxHeight);
    el.style.height = `${next}px`;
    el.style.overflowY = contentHeight > maxHeight ? "auto" : "hidden";
  }, [value, ref, minHeight, maxHeight, resizeTrigger]);
};
