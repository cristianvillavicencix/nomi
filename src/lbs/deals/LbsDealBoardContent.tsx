import { DragDropContext, type OnDragEndResponder } from "@hello-pangea/dnd";
import isEqual from "lodash/isEqual";
import {
  useDataProvider,
  useGetIdentity,
  useListFilterContext,
  useNotify,
} from "ra-core";
import { useCallback, useEffect, useMemo, useState } from "react";

import { DealColumn } from "@/components/atomic-crm/deals/DealColumn";
import {
  updateDealStage,
  updateDealStageLocal,
} from "@/components/atomic-crm/deals/dealStageMutations";
import { getPipelineStages } from "@/components/atomic-crm/deals/pipelines";
import type { DealsByStage } from "@/components/atomic-crm/deals/stages";
import { getDealsByStage } from "@/components/atomic-crm/deals/stages";
import { useDealsRealtime } from "@/components/atomic-crm/deals/useDealsRealtime";
import type { Deal } from "@/components/atomic-crm/types";
import {
  createStageTasksForDeal,
  getStageTasksCreatedMessage,
} from "@/lbs/deals/dealStageTaskTemplates";
import {
  ensureCommissionsForWonDeal,
  getCommissionAutomationMessage,
} from "@/lbs/deals/dealCommissionAutomation";
import { getLaunchStageAdvanceCheck } from "@/lbs/projects/launch/launchChecklistGate";
import { useLbsPipelineConfig } from "@/lbs/deals/useLbsPipelineConfig";
import { useStageDeals } from "@/lbs/deals/useStageDeals";
import type { LbsDeal } from "@/lbs/types";

const LbsDealStageColumn = ({
  stageId,
  pipelineId,
  baseFilter,
  dealsByStage,
  onDealsLoaded,
  isDragging,
}: {
  stageId: string;
  pipelineId: string;
  baseFilter: Record<string, unknown>;
  dealsByStage: DealsByStage;
  onDealsLoaded: (stageId: string, deals: Deal[], total: number) => void;
  isDragging: boolean;
}) => {
  const { deals, total, hasMore, isPending, isFetching, loadMore } =
    useStageDeals(stageId, pipelineId, baseFilter);

  useEffect(() => {
    onDealsLoaded(stageId, deals, total);
  }, [deals, onDealsLoaded, stageId, total]);

  const columnDeals = dealsByStage[stageId] ?? deals;

  return (
    <DealColumn
      stage={stageId}
      deals={columnDeals}
      pipelineId={pipelineId}
      totalCount={total}
      hasMore={hasMore}
      isLoadingMore={isFetching && !isPending}
      onLoadMore={loadMore}
      isDragging={isDragging}
    />
  );
};

export const LbsDealBoardContent = ({ pipelineId }: { pipelineId: string }) => {
  const config = useLbsPipelineConfig();
  const stages = useMemo(
    () => getPipelineStages(config, pipelineId),
    [config, pipelineId],
  );
  const { filterValues } = useListFilterContext();
  const dataProvider = useDataProvider();
  const { data: identity } = useGetIdentity();
  const notify = useNotify();
  const [isDragging, setIsDragging] = useState(false);

  useDealsRealtime();

  const baseFilter = useMemo(() => {
    const next = { ...(filterValues ?? {}) };
    delete next.pipeline_id;
    delete next.stage;
    if (!next["archived_at@is"]) {
      next["archived_at@is"] = null;
    }
    return next;
  }, [filterValues]);

  const [dealsByStage, setDealsByStage] = useState<DealsByStage>(() =>
    getDealsByStage([], stages),
  );

  useEffect(() => {
    setDealsByStage((prev) => {
      const next = getDealsByStage([], stages);
      for (const stage of stages) {
        if (prev[stage.id]?.length) {
          next[stage.id] = prev[stage.id];
        }
      }
      return isEqual(prev, next) ? prev : next;
    });
  }, [stages]);

  const handleDealsLoaded = useCallback(
    (stageId: string, deals: Deal[], total: number) => {
      setDealsByStage((prev) => {
        if (isDragging) return prev;
        const current = prev[stageId] ?? [];
        if (
          current.length === deals.length &&
          current.every((deal, index) => deal.id === deals[index]?.id) &&
          current.length === total
        ) {
          return prev;
        }
        return { ...prev, [stageId]: deals };
      });
    },
    [isDragging],
  );

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

    void getLaunchStageAdvanceCheck(
      dataProvider,
      sourceDeal.id,
      destinationStage,
    )
      .then((launchCheck) => {
        if (!launchCheck.allowed) {
          setDealsByStage(previousState);
          notify(launchCheck.message, { type: "warning", multiLine: true });
          return;
        }
        return updateDealStage(
          sourceDeal,
          destinationDeal,
          dataProvider,
          identity?.id,
        );
      })
      .then(async (result) => {
        if (!result) return;
        const { stageChanged, newStage } = result;
        try {
          const count = await createStageTasksForDeal({
            dataProvider,
            deal: sourceDeal as LbsDeal,
            newStage: newStage ?? destinationStage,
            previousStage: sourceStage,
            organizationMemberId: identity?.id,
          });
          const message = getStageTasksCreatedMessage(
            newStage ?? destinationStage,
            count,
          );
          if (message) notify(message, { type: "info" });
        } catch {
          notify("Project moved, but task templates could not be created", {
            type: "warning",
          });
        }

        if (stageChanged && newStage) {
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
          <LbsDealStageColumn
            key={stage.id}
            stageId={stage.id}
            pipelineId={pipelineId}
            baseFilter={baseFilter}
            dealsByStage={dealsByStage}
            onDealsLoaded={handleDealsLoaded}
            isDragging={isDragging}
          />
        ))}
      </div>
    </DragDropContext>
  );
};
