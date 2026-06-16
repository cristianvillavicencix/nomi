import { useMemo, useState } from "react";
import {
  ShowBase,
  useDataProvider,
  useGetIdentity,
  useNotify,
  useRecordContext,
  useRefresh,
  useUpdate,
} from "ra-core";
import { ArrowLeft } from "lucide-react";
import { Link } from "react-router";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { DealsExplorerPanel } from "@/components/atomic-crm/deals/DealsExplorerPanel";
import { ProjectStageFlow } from "@/components/atomic-crm/deals/ProjectStageFlow";
import { useNavigationLayoutPreference } from "@/components/atomic-crm/layout/navigationLayoutPreference";
import { deliveryStatusForStage } from "@/modules/deals/lbsAgencyProjectModel";
import { LbsDealHeaderOverview } from "@/modules/deals/LbsDealHeaderOverview";
import { LbsProjectDeliveryUrgency } from "@/modules/deals/LbsProjectDeliveryUrgency";
import {
  createBriefGapTasksForDeal,
  createStageTasksForDeal,
  getStageTasksCreatedMessage,
} from "@/modules/deals/dealStageTaskTemplates";
import { ManualHandoffBanner } from "@/modules/deals/ManualHandoffControl";
import { normalizeLbsProjectStage } from "@/modules/deals/lbsProjectConstants";
import { getBriefStageAdvanceCheck } from "@/modules/deals/projectBriefProgress";
import { getLaunchStageAdvanceCheck } from "@/modules/deals/projects/launch/launchChecklistGate";
import { runProjectStageAutomations } from "@/modules/deals/projects/projectStageAutomations";
import { ProjectActionsMenu } from "@/modules/deals/projects/ProjectActionsMenu";
import {
  getProjectDisplayPipelineStages,
  getProjectDisplayStageForDealStage,
  resolveProjectDisplayStageChange,
} from "@/modules/deals/projects/projectDisplayPipeline";
import { ProjectWorkspaceTabs } from "@/modules/deals/projects/ProjectWorkspaceTabs";
import {
  ProjectTasksDialog,
  ProjectTasksRail,
} from "@/modules/deals/projects/ProjectTasksRail";
import { ClientPortalDialog } from "@/modules/portal/ClientPortalDialog";
import type { LbsDeal } from "@/modules/types";
import { isValidRecordId } from "@/lib/isValidRecordId";

const ArchivedTitle = () => (
  <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-2 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-100">
    This project is archived.
  </div>
);

const TASKS_RAIL_STORAGE_KEY = "nomi.project.tasksRail.collapsed";

const readTasksRailCollapsed = () => {
  if (typeof window === "undefined") return false;
  return window.localStorage.getItem(TASKS_RAIL_STORAGE_KEY) === "true";
};

const ProjectShowContent = () => {
  const record = useRecordContext<LbsDeal>();
  const { data: identity } = useGetIdentity();
  const dataProvider = useDataProvider();
  const [tasksRailCollapsed, setTasksRailCollapsed] = useState(
    readTasksRailCollapsed,
  );
  const [tasksDialogOpen, setTasksDialogOpen] = useState(false);
  const [portalDialogOpen, setPortalDialogOpen] = useState(false);

  const handleToggleRail = () => {
    setTasksRailCollapsed((prev) => {
      const next = !prev;
      if (typeof window !== "undefined") {
        window.localStorage.setItem(TASKS_RAIL_STORAGE_KEY, String(next));
      }
      return next;
    });
  };
  const notify = useNotify();
  const refresh = useRefresh();
  const [update, { isPending: isUpdatingStage }] = useUpdate();

  const displayStages = useMemo(() => getProjectDisplayPipelineStages(), []);
  const displayCurrentStage = getProjectDisplayStageForDealStage(record?.stage);

  if (!record) return null;

  const handleStageChange = async (displayStageId: string) => {
    const stageId = resolveProjectDisplayStageChange(
      displayStageId,
      record.stage,
    );
    if (isUpdatingStage || stageId === record.stage) return;

    const briefCheck = getBriefStageAdvanceCheck(record, stageId);
    if (!briefCheck.allowed) {
      notify(briefCheck.message, { type: "warning" });
      return;
    }

    const launchCheck = await getLaunchStageAdvanceCheck(
      dataProvider,
      record.id,
      stageId,
    );
    if (!launchCheck.allowed) {
      notify(launchCheck.message, { type: "warning" });
      return;
    }

    const previousStage = record.stage;
    const normalizedStage = normalizeLbsProjectStage(stageId);
    const nextDeliveryStatus = deliveryStatusForStage(normalizedStage);
    const isClosedStage =
      normalizedStage === "closed_won" || normalizedStage === "delivered";
    const isOpportunityStage = ["lead", "discovery", "proposal_sent"].includes(
      normalizedStage,
    );
    const nextLifecyclePhase = isClosedStage
      ? "closed"
      : isOpportunityStage
        ? "opportunity"
        : "delivery";

    update(
      "deals",
      {
        id: record.id,
        data: {
          stage: stageId,
          delivery_status: nextDeliveryStatus,
          lifecycle_phase: nextLifecyclePhase,
          ...(isClosedStage
            ? { actual_completion_date: new Date().toISOString().slice(0, 10) }
            : {}),
        },
        previousData: record,
        meta: { identity },
      },
      {
        onSuccess: async () => {
          notify("Project stage updated", { type: "info", undoable: false });
          refresh();

          if (!identity?.id) return;

          try {
            const count = await createStageTasksForDeal({
              dataProvider,
              deal: record,
              newStage: stageId,
              previousStage,
              organizationMemberId: identity.id,
            });
            const message = getStageTasksCreatedMessage(stageId, count);
            if (message) notify(message, { type: "info" });

            if (normalizeLbsProjectStage(stageId) === "won") {
              const briefTaskCount = await createBriefGapTasksForDeal({
                dataProvider,
                deal: record,
                organizationMemberId: identity.id,
              });
              if (briefTaskCount > 0) {
                notify(
                  `${briefTaskCount} brief follow-up task${briefTaskCount === 1 ? "" : "s"} added`,
                  { type: "info" },
                );
              }
            }

            await runProjectStageAutomations({
              dataProvider,
              deal: {
                ...record,
                stage: stageId,
                delivery_status: nextDeliveryStatus,
              },
              previousStage,
              organizationMemberId: identity.id,
            });

          } catch {
            notify("Stage updated, but automations could not run", {
              type: "warning",
            });
          }
        },
        onError: () =>
          notify("Error: stage was not updated", { type: "error" }),
      },
    );
  };

  return (
    <div className="space-y-2">
      {record.archived_at ? <ArchivedTitle /> : null}
      <ManualHandoffBanner record={record} />
      <div className="mb-3">
        <Button asChild variant="ghost" size="sm" className="gap-2">
          <Link to="/deals">
            <ArrowLeft className="h-4 w-4" />
            Back to projects
          </Link>
        </Button>
      </div>

      <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 flex-1">
          <LbsDealHeaderOverview record={record} />
        </div>
        <div
          className={cn(
            "flex w-full shrink-0 flex-col gap-2 sm:w-auto sm:flex-row sm:items-center sm:justify-end",
            record.archived_at ? "" : "sm:pr-12",
          )}
        >
          <LbsProjectDeliveryUrgency record={record} />
          <ProjectActionsMenu
            record={record}
            onOpenTasks={() => setTasksDialogOpen(true)}
            onOpenPortal={() => setPortalDialogOpen(true)}
          />
        </div>
      </div>

      <ProjectStageFlow
        stages={displayStages}
        currentStage={displayCurrentStage}
        onStageChange={handleStageChange}
        className="mb-1.5 rounded-b-none pb-2"
      />

      <div className="flex flex-col gap-4 lg:flex-row lg:items-start">
        <div className="min-w-0 flex-1">
          <ProjectWorkspaceTabs record={record} />
        </div>
        <div className="hidden lg:block">
          <ProjectTasksRail
            record={record}
            collapsed={tasksRailCollapsed}
            onToggleCollapsed={handleToggleRail}
          />
        </div>
      </div>

      <ProjectTasksDialog
        record={record}
        open={tasksDialogOpen}
        onOpenChange={setTasksDialogOpen}
      />
      <ClientPortalDialog
        record={record}
        open={portalDialogOpen}
        onOpenChange={setPortalDialogOpen}
      />
    </div>
  );
};

export const ProjectShowPage = ({ id }: { id?: string }) => {
  const [layoutMode] = useNavigationLayoutPreference();
  const validId = isValidRecordId(id) ? id : undefined;
  const showExplorerPanel = layoutMode === "top" && !!validId;

  return (
    <div
      className={cn("w-full py-2", layoutMode === "sidebar" ? "px-4 py-4" : "")}
    >
      <div className={cn(showExplorerPanel ? "flex gap-4" : "")}>
        {showExplorerPanel ? (
          <DealsExplorerPanel currentDealId={validId} />
        ) : null}
        <div className="min-w-0 flex-1">
          {validId ? (
            <ShowBase id={validId}>
              <ProjectShowContent />
            </ShowBase>
          ) : null}
        </div>
      </div>
    </div>
  );
};

export default ProjectShowPage;
