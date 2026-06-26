import {
  AlertTriangle,
  CheckCircle2,
  CircleAlert,
  Loader2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { DeliveryAnalysisItem } from "@/modules/deals/projects/delivery/projectDeliveryAnalysis";

const statusIcon = (status: DeliveryAnalysisItem["status"]) => {
  if (status === "ok") {
    return <CheckCircle2 className="size-5 shrink-0 text-success" />;
  }
  if (status === "warning") {
    return <AlertTriangle className="size-5 shrink-0 text-warning" />;
  }
  return <CircleAlert className="size-5 shrink-0 text-destructive" />;
};

type ProjectDeliveryAnalysisStepProps = {
  items: DeliveryAnalysisItem[];
  isLoading?: boolean;
  analysisSkipped?: boolean;
  onSkipAnalysis?: () => void;
};

export const ProjectDeliveryAnalysisStep = ({
  items,
  isLoading = false,
  analysisSkipped = false,
  onSkipAnalysis,
}: ProjectDeliveryAnalysisStepProps) => {
  if (isLoading) {
    return (
      <div className="flex items-center justify-center gap-2 py-12 text-sm text-muted-foreground">
        <Loader2 className="size-4 animate-spin" />
        Analyzing project…
      </div>
    );
  }

  return (
    <div className="space-y-1">
      {items.map((item) => (
        <div key={item.id} className="border-b py-3 last:border-b-0">
          <div className="flex items-start justify-between gap-3">
            <div className="flex min-w-0 items-start gap-3">
              <div className="pt-0.5">{statusIcon(item.status)}</div>
              <div className="min-w-0 space-y-1">
                <span className="text-sm font-medium">{item.label}</span>
                {item.fixHint && item.status !== "ok" ? (
                  <p className="text-xs text-muted-foreground">
                    {item.fixHint}
                  </p>
                ) : null}
                {item.pendingLabels && item.pendingLabels.length > 0 ? (
                  <ul className="text-xs text-muted-foreground list-disc space-y-0.5 pl-4">
                    {item.pendingLabels.map((label) => (
                      <li key={label}>{label}</li>
                    ))}
                  </ul>
                ) : null}
              </div>
            </div>
            <div className="flex shrink-0 items-center gap-2 text-sm">
              <span
                className={cn(
                  item.status === "warning"
                    ? "font-medium text-warning"
                    : item.status === "error"
                      ? "font-medium text-destructive"
                      : "text-muted-foreground",
                )}
              >
                {item.detail}
              </span>
              {item.id === "brief" && onSkipAnalysis && !analysisSkipped ? (
                <button
                  type="button"
                  className="text-xs font-medium text-primary underline-offset-4 hover:underline"
                  onClick={onSkipAnalysis}
                >
                  Skip
                </button>
              ) : null}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
};
