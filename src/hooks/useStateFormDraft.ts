import { useCallback, useEffect, useRef } from "react";
import {
  clearFormDraft,
  getFormDraft,
  setFormDraft,
} from "@/lib/formPersistence/formDraftStorage";
import { hasMeaningfulFormContent } from "@/lib/formPersistence/hasMeaningfulFormContent";

/** Draft persistence for plain `useState` forms (no react-hook-form). */
export const useStateFormDraft = <T extends Record<string, unknown>>(
  draftKey: string,
  values: T,
  setValues: (next: T) => void,
  enabled = true,
  debounceMs = 500,
) => {
  const restoredRef = useRef(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!enabled) {
      restoredRef.current = false;
      return;
    }
    if (restoredRef.current) return;
    const draft = getFormDraft<T>(draftKey);
    if (draft && hasMeaningfulFormContent(draft)) {
      setValues(draft);
    }
    restoredRef.current = true;
  }, [draftKey, enabled, setValues]);

  useEffect(() => {
    if (!enabled) return;
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      if (hasMeaningfulFormContent(values)) {
        setFormDraft(draftKey, values);
      } else {
        clearFormDraft(draftKey);
      }
    }, debounceMs);
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [debounceMs, draftKey, enabled, values]);

  const clearDraft = useCallback(() => {
    clearFormDraft(draftKey);
  }, [draftKey]);

  const hasContent = hasMeaningfulFormContent(values);

  return { clearDraft, hasContent };
};
