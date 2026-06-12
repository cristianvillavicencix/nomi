import { useCallback, useEffect, useRef } from "react";
import { useDataProvider } from "ra-core";
import type { CrmDataProvider } from "@/components/atomic-crm/providers/types";

type RecordFormEventPayload = {
  token: string;
  event_type: "started" | "field_completed" | "field_focused" | "abandoned";
  field_key?: string;
};

export const useFormEventRecorder = (
  token: string | undefined,
  options: { enabled?: boolean; isPreview?: boolean } = {},
) => {
  const dataProvider = useDataProvider<CrmDataProvider>();
  const hasStarted = useRef(false);
  const hasSubmitted = useRef(false);
  const completedFields = useRef(new Set<string>());
  const lastField = useRef<string | null>(null);
  const enabled =
    Boolean(token) && options.enabled !== false && !options.isPreview;

  const recordEvent = useCallback(
    async (payload: Omit<RecordFormEventPayload, "token">) => {
      if (!enabled || !token) return;
      try {
        await dataProvider.recordFormEvent({
          token,
          ...payload,
        });
      } catch {
        // analytics should never block the form
      }
    },
    [dataProvider, enabled, token],
  );

  const markStarted = useCallback(() => {
    if (!enabled || hasStarted.current) return;
    hasStarted.current = true;
    void recordEvent({ event_type: "started" });
  }, [enabled, recordEvent]);

  const markFieldCompleted = useCallback(
    (fieldKey: string, value: unknown) => {
      if (!enabled) return;
      if (
        value == null ||
        value === "" ||
        (Array.isArray(value) && value.length === 0)
      ) {
        return;
      }
      if (completedFields.current.has(fieldKey)) return;
      completedFields.current.add(fieldKey);
      lastField.current = fieldKey;
      void recordEvent({ event_type: "field_completed", field_key: fieldKey });
    },
    [enabled, recordEvent],
  );

  const markSubmitted = useCallback(() => {
    hasSubmitted.current = true;
  }, []);

  const trackAnswerChange = useCallback(
    (fieldKey: string, value: unknown) => {
      markStarted();
      markFieldCompleted(fieldKey, value);
    },
    [markFieldCompleted, markStarted],
  );

  useEffect(() => {
    if (!enabled) return;
    return () => {
      if (hasStarted.current && !hasSubmitted.current) {
        void recordEvent({
          event_type: "abandoned",
          field_key: lastField.current ?? undefined,
        });
      }
    };
  }, [enabled, recordEvent]);

  return {
    trackAnswerChange,
    markSubmitted,
  };
};
