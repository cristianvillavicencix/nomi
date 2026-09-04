import { useEffect, useMemo, useState } from "react";
import { useDataProvider } from "ra-core";
import { useSearchParams } from "react-router";
import { AlertTriangle, ClipboardList, FileText } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  BRIEF_MIN_PERCENT_TO_LEAVE_SETUP,
  getIncompleteBriefSections,
  getProjectBriefProgress,
} from "@/modules/deals/projectBriefProgress";
import { isBriefRequirementsWaived } from "@/modules/deals/projectManualHandoff";
import {
  LBS_PRE_DELIVERY_STAGES,
  normalizeLbsProjectStage,
} from "@/modules/deals/lbsProjectConstants";
import { getLaunchChecklistBlocker } from "@/modules/deals/projects/launch/launchChecklistGate";
import type { LbsDeal } from "@/modules/types";

const LAUNCH_BANNER_STAGES = new Set(["review", "launch"]);

type ProjectWorkspaceGatesProps = {
  record: LbsDeal;
  onOpenDeliver: () => void;
};

export const ProjectWorkspaceGates = ({
  record,
  onOpenDeliver,
}: ProjectWorkspaceGatesProps) => {
  const dataProvider = useDataProvider();
  const [, setSearchParams] = useSearchParams();
  const [launchMessage, setLaunchMessage] = useState<string | null>(null);

  const stage = normalizeLbsProjectStage(record.stage);
  const briefGate = useMemo(() => {
    if (isBriefRequirementsWaived(record)) return null;
    if (!LBS_PRE_DELIVERY_STAGES.has(stage)) return null;

    const progress = getProjectBriefProgress(record);
    if (progress.percent >= BRIEF_MIN_PERCENT_TO_LEAVE_SETUP) return null;

    const incomplete = getIncompleteBriefSections(record);
    return {
      percent: progress.percent,
      message: `Brief is ${progress.percent}% complete (${BRIEF_MIN_PERCENT_TO_LEAVE_SETUP}% required before delivery).${
        incomplete.length
          ? ` Still missing: ${incomplete.slice(0, 4).join(", ")}${incomplete.length > 4 ? "…" : ""}.`
          : ""
      }`,
    };
  }, [record, stage]);

  useEffect(() => {
    let cancelled = false;

    if (!LAUNCH_BANNER_STAGES.has(stage)) {
      setLaunchMessage(null);
      return;
    }

    void getLaunchChecklistBlocker(dataProvider, record.id).then((blocker) => {
      if (cancelled) return;
      setLaunchMessage(blocker?.message ?? null);
    });

    return () => {
      cancelled = true;
    };
  }, [dataProvider, record.id, stage]);

  if (!briefGate && !launchMessage) return null;

  const openBriefTab = () => {
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        next.set("tab", "website-brief");
        return next;
      },
      { replace: true },
    );
  };

  return (
    <div className="flex flex-col gap-2">
      {briefGate ? (
        <Alert variant="warning">
          <FileText />
          <AlertTitle>Brief incomplete</AlertTitle>
          <AlertDescription className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <span>{briefGate.message}</span>
            <Button
              type="button"
              size="sm"
              variant="secondary"
              className="shrink-0 self-start"
              onClick={openBriefTab}
            >
              Open brief
            </Button>
          </AlertDescription>
        </Alert>
      ) : null}

      {launchMessage ? (
        <Alert variant="warning">
          <AlertTriangle />
          <AlertTitle>Launch checklist</AlertTitle>
          <AlertDescription className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <span>{launchMessage}</span>
            <Button
              type="button"
              size="sm"
              variant="secondary"
              className="shrink-0 self-start"
              onClick={onOpenDeliver}
            >
              <ClipboardList className="size-4" />
              Open Deliver
            </Button>
          </AlertDescription>
        </Alert>
      ) : null}
    </div>
  );
};
