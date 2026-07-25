import { useEffect, useRef } from "react";

/**
 * Runs `save` after `delayMs` when `value` changes due to user edits.
 * While `enabled` is false, value updates only sync the internal baseline
 * (e.g. server hydration) and never trigger a save.
 */
export const useDebouncedSave = <T>(
  value: T,
  save: (value: T) => void | Promise<void>,
  {
    delayMs = 600,
    enabled = true,
    isEqual = (a, b) => a === b,
  }: {
    delayMs?: number;
    enabled?: boolean;
    isEqual?: (a: T, b: T) => boolean;
  } = {},
) => {
  const baseline = useRef(value);
  const saveRef = useRef(save);
  saveRef.current = save;

  useEffect(() => {
    if (!enabled) {
      baseline.current = value;
      return;
    }

    if (isEqual(value, baseline.current)) return;

    const timer = window.setTimeout(() => {
      void Promise.resolve(saveRef.current(value)).then(() => {
        baseline.current = value;
      });
    }, delayMs);

    return () => window.clearTimeout(timer);
  }, [value, delayMs, enabled, isEqual]);
};
