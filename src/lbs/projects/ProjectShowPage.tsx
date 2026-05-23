import { useMemo } from "react";
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
import { DeleteButton } from "@/components/admin/delete-button";
import { EditButton } from "@/components/admin/edit-button";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { DealsExplorerPanel } from "@/components/atomic-crm/deals/DealsExplorerPanel";
import { getPipelineStages } from "@/components/atomic-crm/deals/pipelines";
import { ProjectStageFlow } from "@/components/atomic-crm/deals/ProjectStageFlow";
import { useNavigationLayoutPreference } from "@/components/atomic-crm/layout/navigationLayoutPreference";
import { canUseCrmPermission } from "@/components/atomic-crm/providers/commons/crmPermissions";
import { useConfigurationContext } from "@/components/atomic-crm/root/ConfigurationContext";
import { ShareRecordModal } from "@/components/atomic-crm/settings/ShareRecordModal";
import type { Deal } from "@/components/atomic-crm/types";
import { deliveryStatusForStage } from "@/lbs/deals/lbsAgencyProjectModel";
import { DealClientSmsButton } from "@/lbs/deals/DealClientSmsButton";
import { LbsDealHeaderOverview } from "@/lbs/deals/LbsDealHeaderOverview";
import { LbsProjectDeliveryUrgency } from "@/lbs/deals/LbsProjectDeliveryUrgency";
import {
  createBriefGapTasksForDeal,
  createStageTasksForDeal,
  getStageTasksCreatedMessage,
} from "@/lbs/deals/dealStageTaskTemplates";
import {
  ensureCommissionsForWonDeal,
  getCommissionAutomationMessage,
} from "@/lbs/deals/dealCommissionAutomation";
import { normalizeLbsProjectStage } from "@/lbs/deals/lbsProjectConstants";
import { getBriefStageAdvanceCheck } from "@/lbs/deals/projectBriefProgress";
import { getLaunchStageAdvanceCheck } from "@/lbs/projects/launch/launchChecklistGate";
import { runProjectStageAutomations } from "@/lbs/projects/projectStageAutomations";
import { ProjectWorkspaceTabs } from "@/lbs/projects/ProjectWorkspaceTabs";
import type { LbsDeal } from "@/lbs/types";

const ArchivedTitle = () => (
  <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-2 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-100">
    This project is archived.
  </div>
);

const ArchiveButton = ({ record }: { record: Deal }) => {
  const [update] = useUpdate();
  const notify = useNotify();
  const refresh = useRefresh();

  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      onClick={() =>
        update(
          "deals",
          {
            id: record.id,
            data: { archived_at: new Date().toISOString() },
            previousData: record,
          },
          {
            onSuccess: () => {
              notify("Project archived", { type: "info" });
              refresh();
            },
            onError: () =>
              notify("Could not archive project", { type: "error" }),
          },
        )
      }
    >
      Archive
    </Button>
  );
};

const UnarchiveButton = ({ record }: { record: Deal }) => {
  const [update] = useUpdate();
  const notify = useNotify();
  const refresh = useRefresh();

  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      onClick={() =>
        update(
          "deals",
          {
            id: record.id,
            data: { archived_at: null },
            previousData: record,
          },
          {
            onSuccess: () => {
              notify("Project restored", { type: "info" });
              refresh();
            },
            onError: () =>
              notify("Could not restore project", { type: "error" }),
          },
        )
      }
    >
      Restore
    </Button>
  );
};

const ProjectShowContent = () => {
  const config = useConfigurationContext();
  const record = useRecordContext<LbsDeal>();
  const { data: identity } = useGetIdentity();
  const dataProvider = useDataProvider();
  const notify = useNotify();
  const refresh = useRefresh();
  const [update, { isPending: isUpdatingStage }] = useUpdate();

  const pipelineStages = useMemo(
    () => getPipelineStages(config, record?.pipeline_id),
    [config, record?.pipeline_id],
  );

  if (!record) return null;

  const canManageSales = canUseCrmPermission(
    identity as Parameters<typeof canUseCrmPermission>[0],
    "sales.manage",
  );

  const handleStageChange = async (stageId: string) => {
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

            const commissionCount = await ensureCommissionsForWonDeal({
              dataProvider,
              deal: { ...record, stage: stageId },
            });
            const commissionMessage =
              getCommissionAutomationMessage(commissionCount);
            if (commissionMessage) notify(commissionMessage, { type: "info" });
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
          <div className="flex flex-wrap gap-2">
            <DealClientSmsButton record={record} />
            <ShareRecordModal
              resourceType="deals"
              resourceId={record.id}
              orgId={(record as { org_id?: number }).org_id}
            />
            {record.archived_at && canManageSales ? (
              <>
                <UnarchiveButton record={record} />
                <DeleteButton />
              </>
            ) : null}
            {!record.archived_at && canManageSales ? (
              <>
                <ArchiveButton record={record} />
                <EditButton />
              </>
            ) : null}
          </div>
        </div>
      </div>

      <ProjectStageFlow
        stages={pipelineStages}
        currentStage={record.stage}
        onStageChange={handleStageChange}
        className="mb-1.5 rounded-b-none pb-2"
      />

      <ProjectWorkspaceTabs record={record} />
    </div>
  );
};

export const ProjectShowPage = ({ id }: { id?: string }) => {
  const [layoutMode] = useNavigationLayoutPreference();
  const showExplorerPanel = layoutMode === "top" && !!id;

  return (
    <div
      className={cn("w-full py-2", layoutMode === "sidebar" ? "px-4 py-4" : "")}
    >
      <div className={cn(showExplorerPanel ? "flex gap-4" : "")}>
        {showExplorerPanel ? <DealsExplorerPanel currentDealId={id} /> : null}
        <div className="min-w-0 flex-1">
          {id ? (
            <ShowBase id={id}>
              <ProjectShowContent />
            </ShowBase>
          ) : null}
        </div>
      </div>
    </div>
  );
};

export default ProjectShowPage;
