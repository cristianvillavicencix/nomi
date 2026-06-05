import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  useFormContext,
  useFormState,
  type FieldValues,
} from "react-hook-form";
import { useBlocker } from "react-router";
import {
  clearFormDraft,
  getFormDraft,
  setFormDraft,
} from "@/lib/formPersistence/formDraftStorage";
import { hasMeaningfulFormContent } from "@/lib/formPersistence/hasMeaningfulFormContent";
import { LeaveWithoutSavingDialog } from "./LeaveWithoutSavingDialog";

type FormGuardContextValue = {
  isDirty: boolean;
  hasDraftContent: boolean;
  shouldConfirmLeave: boolean;
  clearDraft: () => void;
  requestClose: (onConfirmed: () => void) => void;
};

const FormGuardContext = createContext<FormGuardContextValue | null>(null);

export const useFormGuard = () => {
  const ctx = useContext(FormGuardContext);
  if (!ctx) {
    throw new Error("useFormGuard must be used within FormGuardProvider");
  }
  return ctx;
};

export const useOptionalFormGuard = () => useContext(FormGuardContext);

type FormGuardProviderProps = {
  draftKey: string;
  enabled?: boolean;
  debounceMs?: number;
  children: ReactNode;
};

export const FormGuardProvider = ({
  draftKey,
  enabled = true,
  debounceMs = 500,
  children,
}: FormGuardProviderProps) => {
  const { watch, reset, getValues } = useFormContext<FieldValues>();
  const { isDirty } = useFormState();
  const isDirtyRef = useRef(isDirty);
  useEffect(() => {
    isDirtyRef.current = isDirty;
  }, [isDirty]);
  const restoredRef = useRef(false);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingCloseRef = useRef<(() => void) | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);

  const clearDraft = useCallback(() => {
    clearFormDraft(draftKey);
  }, [draftKey]);

  useEffect(() => {
    if (!enabled) {
      restoredRef.current = false;
      return;
    }
    if (restoredRef.current) return;

    const draft = getFormDraft<FieldValues>(draftKey);
    if (draft && hasMeaningfulFormContent(draft)) {
      reset(draft, { keepDefaultValues: true });
    }
    restoredRef.current = true;
  }, [draftKey, enabled, reset]);

  useEffect(() => {
    if (!enabled) return;

    const subscription = watch((values) => {
      if (saveTimerRef.current) {
        clearTimeout(saveTimerRef.current);
      }
      saveTimerRef.current = setTimeout(() => {
        if (isDirtyRef.current && hasMeaningfulFormContent(values)) {
          setFormDraft(draftKey, values);
        }
      }, debounceMs);
    });

    return () => {
      subscription.unsubscribe();
      if (saveTimerRef.current) {
        clearTimeout(saveTimerRef.current);
      }
    };
  }, [debounceMs, draftKey, enabled, watch]);

  const hasDraftContent = hasMeaningfulFormContent(getValues());
  const shouldConfirmLeave = isDirty;

  const requestClose = useCallback(
    (onConfirmed: () => void) => {
      if (!shouldConfirmLeave) {
        onConfirmed();
        return;
      }
      pendingCloseRef.current = onConfirmed;
      setConfirmOpen(true);
    },
    [shouldConfirmLeave],
  );

  const value = useMemo<FormGuardContextValue>(
    () => ({
      isDirty,
      hasDraftContent,
      shouldConfirmLeave,
      clearDraft,
      requestClose,
    }),
    [clearDraft, hasDraftContent, isDirty, requestClose, shouldConfirmLeave],
  );

  return (
    <FormGuardContext.Provider value={value}>
      {children}
      <LeaveWithoutSavingDialog
        open={confirmOpen}
        onStay={() => {
          setConfirmOpen(false);
          pendingCloseRef.current = null;
        }}
        onLeave={() => {
          setConfirmOpen(false);
          clearDraft();
          pendingCloseRef.current?.();
          pendingCloseRef.current = null;
        }}
        description="You have unsaved changes. A local draft is saved on this device for up to 7 days. Stay to keep editing, or leave and reopen this form later to recover your draft."
      />
    </FormGuardContext.Provider>
  );
};

/** Blocks in-app navigation and tab close while the form has unsaved content. */
export const FormNavigationGuard = ({ enabled = true }: { enabled?: boolean }) => {
  const guard = useOptionalFormGuard();
  const shouldBlock = enabled && (guard?.shouldConfirmLeave ?? false);
  const [confirmOpen, setConfirmOpen] = useState(false);

  const blocker = useBlocker(
    ({ currentLocation, nextLocation }) =>
      shouldBlock && currentLocation.pathname !== nextLocation.pathname,
  );

  useEffect(() => {
    if (blocker.state === "blocked") {
      setConfirmOpen(true);
    }
  }, [blocker.state]);

  useEffect(() => {
    if (!shouldBlock) return;
    const handler = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [shouldBlock]);

  if (!guard) return null;

  return (
    <LeaveWithoutSavingDialog
      open={confirmOpen}
      onStay={() => {
        setConfirmOpen(false);
        if (blocker.state === "blocked") {
          blocker.reset();
        }
      }}
      onLeave={() => {
        setConfirmOpen(false);
        guard.clearDraft();
        if (blocker.state === "blocked") {
          blocker.proceed();
        }
      }}
      title="Leave this page?"
      description="You have unsaved changes. A local draft is saved on this device for up to 7 days. Stay to keep editing, or leave and come back later to recover your draft."
    />
  );
};

/** Wrap Dialog `onOpenChange` so closing asks for confirmation when needed. */
export const useGuardedDialogClose = (
  onOpenChange: (open: boolean) => void,
) => {
  const guard = useFormGuard();

  return useCallback(
    (next: boolean) => {
      if (next) {
        onOpenChange(true);
        return;
      }
      guard.requestClose(() => onOpenChange(false));
    },
    [guard, onOpenChange],
  );
};

/** Call after a successful save/create to drop the local draft. */
export const useClearFormDraftOnSuccess = () => {
  const guard = useOptionalFormGuard();
  return useCallback(() => {
    guard?.clearDraft();
  }, [guard]);
};
