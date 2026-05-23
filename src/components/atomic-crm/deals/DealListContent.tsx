import { DragDropContext, type OnDragEndResponder } from "@hello-pangea/dnd";
import isEqual from "lodash/isEqual";
import {
  useDataProvider,
  useGetIdentity,
  useListContext,
  useNotify,
} from "ra-core";
import { useEffect, useMemo, useState } from "react";

import { useConfigurationContext } from "../root/ConfigurationContext";
import type { Deal } from "../types";
import { DealColumn } from "./DealColumn";
import {
  updateDealStage,
  updateDealStageLocal,
} from "./dealStageMutations";
import { getPipelineStages } from "./pipelines";
import type { DealsByStage } from "./stages";
import { getDealsByStage } from "./stages";
import { isLbsMode } from "@/lbs/productMode";
import {
  createStageTasksForDeal,
  getStageTasksCreatedMessage,
} from "@/lbs/deals/dealStageTaskTemplates";
import {
  ensureCommissionsForWonDeal,
  getCommissionAutomationMessage,
} from "@/lbs/deals/dealCommissionAutomation";
import type { LbsDeal } from "@/lbs/types";

export const DealListContent = ({ pipelineId }: { pipelineId: string }) => {
  const config = useConfigurationContext();
  const stages = useMemo(
    () => getPipelineStages(config, pipelineId),
    [config, pipelineId],
  );
  const { data: unorderedDeals, isPending, refetch } = useListContext<Deal>();
  const dataProvider = useDataProvider();
  const { data: identity } = useGetIdentity();
  const notify = useNotify();
  const [isDragging, setIsDragging] = useState(false);

  const [dealsByStage, setDealsByStage] = useState<DealsByStage>(
    getDealsByStage([], stages),
  );

  useEffect(() => {
    if (unorderedDeals) {
      const pipelineDeals = unorderedDeals.filter(
        (deal) => (deal.pipeline_id || pipelineId) === pipelineId,
      );
      const newDealsByStage = getDealsByStage(pipelineDeals, stages);
      if (!isEqual(newDealsByStage, dealsByStage)) {
        setDealsByStage(newDealsByStage);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [unorderedDeals, pipelineId, stages]);

  if (isPending) return null;

  const onDragEnd: OnDragEndResponder = (result) => {
    setIsDragging(false);
    const { destination, source } = result;

    if (!destination) {
      return;
    }

    if (
      destination.droppableId === source.droppableId &&
      destination.index === source.index
    ) {
      return;
    }

    const sourceStage = source.droppableId;
    const destinationStage = destination.droppableId;
    const sourceDeal = dealsByStage[sourceStage][source.index]!;
    const destinationDeal = dealsByStage[destinationStage][destination.index] ?? {
      stage: destinationStage,
      index: undefined,
    };
    const previousState = dealsByStage;

    setDealsByStage(
      updateDealStageLocal(
        sourceDeal,
        { stage: sourceStage, index: source.index },
        { stage: destinationStage, index: destination.index },
        dealsByStage,
      ),
    );

    void updateDealStage(
      sourceDeal,
      destinationDeal,
      dataProvider,
      identity?.id,
    )
      .then(async ({ stageChanged, newStage }) => {
        refetch();
        if (isLbsMode() && stageChanged && newStage && identity?.id) {
          try {
            const count = await createStageTasksForDeal({
              dataProvider,
              deal: sourceDeal as LbsDeal,
              newStage,
              previousStage: sourceStage,
              organizationMemberId: identity.id,
            });
            const message = getStageTasksCreatedMessage(newStage, count);
            if (message) notify(message, { type: "info" });
          } catch {
            notify("Project moved, but task templates could not be created", {
              type: "warning",
            });
          }

          try {
            const commissionCount = await ensureCommissionsForWonDeal({
              dataProvider,
              deal: { ...(sourceDeal as LbsDeal), stage: newStage },
            });
            const commissionMessage =
              getCommissionAutomationMessage(commissionCount);
            if (commissionMessage) notify(commissionMessage, { type: "info" });
          } catch {
            notify("Project moved, but commissions could not be created", {
              type: "warning",
            });
          }
        }
      })
      .catch((error: unknown) => {
        setDealsByStage(previousState);
        const message =
          error instanceof Error ? error.message : "Failed to update project";
        notify(`Failed to update project: ${message}`, {
          type: "error",
          multiLine: true,
        });
      });
  };

  return (
    <DragDropContext
      onDragStart={() => setIsDragging(true)}
      onDragEnd={onDragEnd}
    >
      <div className="flex gap-4 overflow-x-auto pb-2">
        {stages.map((stage) => (
          <DealColumn
            stage={stage.id}
            deals={dealsByStage[stage.id]}
            key={stage.id}
            pipelineId={pipelineId}
            isDragging={isDragging}
          />
        ))}
      </div>
    </DragDropContext>
  );
};
