import { Check, Circle, Loader2, X, XCircle } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";

export type SendProgressStepStatus =
  | "pending"
  | "running"
  | "done"
  | "error"
  | "skipped";

export type SendProgressStep = {
  id: string;
  label: string;
  status: SendProgressStepStatus;
  detail?: string;
};

export type SendProgressOutcome = "idle" | "running" | "success" | "error";

type StepDef = { id: string; label: string };

const AUTO_CLOSE_MS = 4500;

const statusIcon = (status: SendProgressStepStatus) => {
  switch (status) {
    case "running":
      return <Loader2 className="size-3.5 animate-spin text-primary" />;
    case "done":
      return <Check className="size-3.5 text-success" />;
    case "error":
      return <XCircle className="size-3.5 text-destructive" />;
    case "skipped":
      return <Circle className="size-3.5 text-muted-foreground/50" />;
    default:
      return <Circle className="size-3.5 text-muted-foreground/40" />;
  }
};

export const SendProgressDock = ({
  open,
  title,
  steps,
  outcome,
  summary,
  onDismiss,
}: {
  open: boolean;
  title: string;
  steps: SendProgressStep[];
  outcome: SendProgressOutcome;
  summary: string;
  onDismiss: () => void;
}) => {
  if (!open || typeof document === "undefined") return null;

  const doneCount = steps.filter(
    (step) => step.status === "done" || step.status === "skipped",
  ).length;
  const progressValue =
    steps.length === 0 ? 0 : Math.round((doneCount / steps.length) * 100);
  const showBar = outcome === "running";

  return createPortal(
    <div
      className="pointer-events-none fixed inset-x-0 bottom-0 z-[80] flex justify-center p-3 md:p-4"
      role="status"
      aria-live="polite"
    >
      <div
        className={cn(
          "pointer-events-auto w-full max-w-md overflow-hidden rounded-lg border bg-background shadow-lg",
          outcome === "success" && "border-success/40",
          outcome === "error" && "border-destructive/40",
        )}
      >
        <div className="flex items-start justify-between gap-2 border-b px-3 py-2.5">
          <div className="min-w-0">
            <p className="truncate text-sm font-medium">{title}</p>
            {summary ? (
              <p
                className={cn(
                  "mt-0.5 text-xs",
                  outcome === "success" && "text-success",
                  outcome === "error" && "text-destructive",
                  outcome === "running" && "text-muted-foreground",
                )}
              >
                {summary}
              </p>
            ) : null}
          </div>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="size-7 shrink-0"
            aria-label="Dismiss"
            onClick={onDismiss}
          >
            <X className="size-3.5" />
          </Button>
        </div>

        {showBar ? (
          <Progress value={Math.max(progressValue, 8)} className="h-1 rounded-none" />
        ) : null}

        <ul className="space-y-1.5 px-3 py-2.5">
          {steps.map((step) => (
            <li key={step.id} className="flex items-start gap-2 text-xs">
              <span className="mt-0.5 shrink-0">{statusIcon(step.status)}</span>
              <span className="min-w-0 flex-1">
                <span
                  className={cn(
                    "block font-medium",
                    step.status === "pending" && "text-muted-foreground",
                    step.status === "skipped" && "text-muted-foreground",
                    step.status === "error" && "text-destructive",
                  )}
                >
                  {step.label}
                </span>
                {step.detail ? (
                  <span className="mt-0.5 block text-muted-foreground">
                    {step.detail}
                  </span>
                ) : null}
              </span>
            </li>
          ))}
        </ul>

        {outcome === "success" ? (
          <div className="border-t bg-success/5 px-3 py-2 text-xs font-medium text-success">
            All steps completed — delivery succeeded.
          </div>
        ) : null}
        {outcome === "error" ? (
          <div className="border-t bg-destructive/5 px-3 py-2 text-xs text-destructive">
            Something failed. Check the step above and try again.
          </div>
        ) : null}
      </div>
    </div>,
    document.body,
  );
};

export const useSendProgressDock = () => {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [steps, setSteps] = useState<SendProgressStep[]>([]);
  const [outcome, setOutcome] = useState<SendProgressOutcome>("idle");
  const [summary, setSummary] = useState("");
  const autoCloseRef = useRef<number | null>(null);

  const clearAutoClose = useCallback(() => {
    if (autoCloseRef.current != null) {
      window.clearTimeout(autoCloseRef.current);
      autoCloseRef.current = null;
    }
  }, []);

  useEffect(() => () => clearAutoClose(), [clearAutoClose]);

  const dismiss = useCallback(() => {
    clearAutoClose();
    setOpen(false);
    setOutcome("idle");
    setSummary("");
    setSteps([]);
  }, [clearAutoClose]);

  const begin = useCallback(
    (nextTitle: string, defs: StepDef[]) => {
      clearAutoClose();
      setTitle(nextTitle);
      setSteps(
        defs.map((def) => ({
          id: def.id,
          label: def.label,
          status: "pending" as const,
        })),
      );
      setOutcome("running");
      setSummary("Working…");
      setOpen(true);
    },
    [clearAutoClose],
  );

  const patchStep = useCallback(
    (id: string, patch: Partial<Pick<SendProgressStep, "status" | "detail">>) => {
      setSteps((current) =>
        current.map((step) =>
          step.id === id ? { ...step, ...patch } : step,
        ),
      );
    },
    [],
  );

  const runStep = useCallback(
    (id: string) => patchStep(id, { status: "running", detail: undefined }),
    [patchStep],
  );

  const completeStep = useCallback(
    (id: string, detail?: string) =>
      patchStep(id, { status: "done", detail }),
    [patchStep],
  );

  const skipStep = useCallback(
    (id: string, detail?: string) =>
      patchStep(id, { status: "skipped", detail }),
    [patchStep],
  );

  const failStep = useCallback(
    (id: string, detail?: string) => {
      patchStep(id, { status: "error", detail });
      setOutcome("error");
      setSummary(detail?.trim() || "Send failed");
      clearAutoClose();
    },
    [clearAutoClose, patchStep],
  );

  const succeed = useCallback(
    (nextSummary: string) => {
      setSteps((current) =>
        current.map((step) =>
          step.status === "pending" || step.status === "running"
            ? { ...step, status: "done" as const }
            : step,
        ),
      );
      setOutcome("success");
      setSummary(nextSummary);
      clearAutoClose();
      autoCloseRef.current = window.setTimeout(() => {
        setOpen(false);
        setOutcome("idle");
      }, AUTO_CLOSE_MS);
    },
    [clearAutoClose],
  );

  const fail = useCallback(
    (nextSummary: string) => {
      setOutcome("error");
      setSummary(nextSummary);
      clearAutoClose();
    },
    [clearAutoClose],
  );

  return {
    begin,
    runStep,
    completeStep,
    skipStep,
    failStep,
    succeed,
    fail,
    dismiss,
    dock: (
      <SendProgressDock
        open={open}
        title={title}
        steps={steps}
        outcome={outcome}
        summary={summary}
        onDismiss={dismiss}
      />
    ),
  };
};

/** Tiny pause so the UI can paint step transitions during a single network call. */
export const paintSendProgress = () =>
  new Promise<void>((resolve) => {
    window.requestAnimationFrame(() => {
      window.setTimeout(resolve, 180);
    });
  });
