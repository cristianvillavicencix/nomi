import { Bell, CheckCircle2, Loader2 } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import type { WebsiteAudit } from "@/lbs/website-monitor/audit/types";
import { AUDIT_PROGRESS_STEPS } from "@/lbs/website-monitor/audit/websiteAuditProgress";
import { useWebsiteAuditProgress } from "@/lbs/website-monitor/audit/useWebsiteAuditProgress";

const requestBrowserNotifications = async () => {
  if (!("Notification" in window)) return false;
  if (Notification.permission === "granted") return true;
  if (Notification.permission === "denied") return false;
  const result = await Notification.requestPermission();
  return result === "granted";
};

export const WebsiteAuditProgressBar = ({ audit }: { audit: WebsiteAudit }) => {
  const progress = useWebsiteAuditProgress(audit);
  const [notificationsEnabled, setNotificationsEnabled] = useState(
    () =>
      typeof window !== "undefined" &&
      "Notification" in window &&
      Notification.permission === "granted",
  );

  if (!progress || progress.isFailed) {
    return null;
  }

  const handleEnableNotifications = async () => {
    const granted = await requestBrowserNotifications();
    setNotificationsEnabled(granted);
  };

  return (
    <div className="space-y-3 rounded-lg border border-border/60 bg-muted/20 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <p className="flex items-center gap-2 text-sm font-medium">
            {progress.isComplete ? (
              <CheckCircle2 className="size-4 text-green-600" />
            ) : (
              <Loader2 className="size-4 animate-spin text-primary" />
            )}
            {progress.isComplete ? "Reporte listo" : progress.phaseLabel}
          </p>
          <p className="text-xs text-muted-foreground">
            {progress.isComplete
              ? "Ya puedes abrir el portal y descargar el PDF."
              : "Puedes salir de esta pantalla — el análisis sigue en segundo plano y te avisamos cuando termine."}
          </p>
        </div>
        <span className="text-sm font-semibold tabular-nums text-primary">
          {progress.percent}%
        </span>
      </div>

      <Progress value={progress.percent} className="h-2" />

      <ol className="flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
        {AUDIT_PROGRESS_STEPS.map((label, index) => {
          const isDone = progress.isComplete || index < progress.phaseIndex;
          const isCurrent = !progress.isComplete && index === progress.phaseIndex;
          return (
            <li
              key={label}
              className={
                isCurrent
                  ? "font-medium text-foreground"
                  : isDone
                    ? "text-foreground/70"
                    : undefined
              }
            >
              {isDone ? "✓ " : isCurrent ? "● " : "○ "}
              {label}
            </li>
          );
        })}
      </ol>

      {!progress.isComplete &&
      !notificationsEnabled &&
      typeof window !== "undefined" &&
      "Notification" in window &&
      Notification.permission !== "denied" ? (
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="h-8"
          onClick={() => void handleEnableNotifications()}
        >
          <Bell className="mr-2 size-3.5" />
          Activar avisos del navegador
        </Button>
      ) : null}
    </div>
  );
};
