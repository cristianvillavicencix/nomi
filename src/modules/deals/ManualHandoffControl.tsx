import { useState } from "react";
import { HandMetal, RotateCcw } from "lucide-react";
import { Confirm } from "@/components/admin/confirm";
import { Button } from "@/components/ui/button";
import { getManualHandoffAt } from "@/modules/deals/projectManualHandoff";
import { useManualHandoffActions } from "@/modules/deals/useManualHandoffActions";
import type { LbsDeal } from "@/modules/types";

const formatHandoffDate = (value: string) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
};

type ManualHandoffControlProps = {
  record: LbsDeal;
  variant?: "banner" | "panel";
};

export const ManualHandoffBanner = ({ record }: { record: LbsDeal }) => (
  <ManualHandoffControl record={record} variant="banner" />
);

export const ManualHandoffControl = ({
  record,
  variant = "panel",
}: ManualHandoffControlProps) => {
  const { waived, setWaived, isPending } = useManualHandoffActions(record);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [nextEnabled, setNextEnabled] = useState(true);

  const handoffAt = getManualHandoffAt(record);

  const openConfirm = (enable: boolean) => {
    setNextEnabled(enable);
    setConfirmOpen(true);
  };

  const handleConfirm = () => {
    setWaived(nextEnabled);
    setConfirmOpen(false);
  };

  if (variant === "banner") {
    if (!waived) return null;
    return (
      <div className="rounded-lg border border-sky-200 bg-sky-50 px-4 py-2.5 text-sm text-sky-950 dark:border-sky-900 dark:bg-sky-950/40 dark:text-sky-100">
        <span className="font-medium">Manual handoff</span>
        {" — "}
        Website brief is optional for this legacy project.
        {handoffAt ? ` Enabled ${formatHandoffDate(handoffAt)}.` : null}
      </div>
    );
  }

  return (
    <>
      <div
        className={
          waived
            ? "rounded-lg border border-sky-200 bg-sky-50/80 px-4 py-3 dark:border-sky-900 dark:bg-sky-950/30"
            : "rounded-lg border border-dashed px-4 py-3"
        }
      >
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-1 text-sm">
            <p className="font-medium">
              {waived ? "Manual handoff active" : "Legacy or completed project?"}
            </p>
            <p className="text-muted-foreground">
              {waived
                ? "Pipeline stage changes no longer require the website brief. Add credentials in Security and deliver from the Delivery tab."
                : "Enable manual handoff when the site was built outside Nomi. Brief completion will no longer block pipeline or delivery."}
            </p>
            {waived && handoffAt ? (
              <p className="text-xs text-muted-foreground">
                Enabled {formatHandoffDate(handoffAt)}
              </p>
            ) : null}
          </div>
          <Button
            type="button"
            variant={waived ? "outline" : "secondary"}
            size="sm"
            className="shrink-0"
            disabled={isPending}
            onClick={() => openConfirm(!waived)}
          >
            {waived ? (
              <>
                <RotateCcw className="size-4" />
                Restore brief requirements
              </>
            ) : (
              <>
                <HandMetal className="size-4" />
                Enable manual handoff
              </>
            )}
          </Button>
        </div>
      </div>

      <Confirm
        isOpen={confirmOpen}
        title={
          nextEnabled
            ? "Enable manual handoff?"
            : "Restore brief requirements?"
        }
        content={
          nextEnabled
            ? "Use this for projects completed on another platform. The website brief will no longer block pipeline stage changes or delivery."
            : "The 70% brief requirement will apply again when moving this project toward delivery."
        }
        confirm={nextEnabled ? "Enable manual handoff" : "Restore requirements"}
        confirmColor={nextEnabled ? "primary" : "warning"}
        loading={isPending}
        onClose={() => setConfirmOpen(false)}
        onConfirm={handleConfirm}
      />
    </>
  );
};
