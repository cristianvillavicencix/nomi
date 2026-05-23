import { Droppable } from "@hello-pangea/dnd";
import { useVirtualizer } from "@tanstack/react-virtual";
import { useRef } from "react";

import { Button } from "@/components/ui/button";
import { MoneyText } from "@/lib/permissions/MoneyText";
import { useCanViewAmounts } from "@/lib/permissions/useMaskedAmount";
import { useConfigurationContext } from "../root/ConfigurationContext";
import type { Deal } from "../types";
import { getStageColor, getStageLabel } from "./pipelines";
import { DealCard } from "./DealCard";

const VIRTUAL_SCROLL_THRESHOLD = 30;
const COLUMN_MAX_HEIGHT = "70vh";
const ESTIMATED_CARD_HEIGHT = 128;

export const DealColumn = ({
  stage,
  deals,
  pipelineId,
  totalCount,
  hasMore,
  isLoadingMore,
  onLoadMore,
  isDragging = false,
}: {
  stage: string;
  deals: Deal[];
  pipelineId: string;
  totalCount?: number;
  hasMore?: boolean;
  isLoadingMore?: boolean;
  onLoadMore?: () => void;
  isDragging?: boolean;
}) => {
  const totalAmount = deals.reduce(
    (sum, deal) => sum + Number(deal.amount ?? 0),
    0,
  );
  const config = useConfigurationContext();
  const canViewAmounts = useCanViewAmounts();
  const stageColor = getStageColor(config, stage, pipelineId);
  const columnRef = useRef<HTMLDivElement>(null);
  const useVirtual =
    !isDragging && deals.length > VIRTUAL_SCROLL_THRESHOLD && !onLoadMore;

  const virtualizer = useVirtualizer({
    count: deals.length,
    getScrollElement: () => columnRef.current,
    estimateSize: () => ESTIMATED_CARD_HEIGHT,
    overscan: 4,
  });

  const countLabel =
    totalCount != null && totalCount !== deals.length
      ? `${deals.length} of ${totalCount}`
      : String(deals.length);

  return (
    <div className="min-w-[280px] flex-1 pb-8">
      <div className="flex flex-col items-center">
        <h3 className="flex items-center gap-2 text-base font-medium">
          <span
            className="h-2.5 w-2.5 rounded-full"
            style={{ backgroundColor: stageColor }}
          />
          {getStageLabel(config, stage, pipelineId)}
        </h3>
        <p className="text-xs text-muted-foreground">{countLabel} projects</p>
        {canViewAmounts && (
          <p className="text-sm text-muted-foreground">
            <MoneyText value={totalAmount} compact />
          </p>
        )}
      </div>
      <Droppable droppableId={stage}>
        {(droppableProvided, snapshot) => (
          <div
            ref={droppableProvided.innerRef}
            {...droppableProvided.droppableProps}
            className={`mt-2 rounded-2xl ${
              snapshot.isDraggingOver ? "bg-muted" : ""
            }`}
          >
            <div
              ref={columnRef}
              className="flex flex-col gap-2 overflow-y-auto"
              style={{ maxHeight: COLUMN_MAX_HEIGHT }}
            >
              {useVirtual ? (
                <div
                  style={{
                    height: `${virtualizer.getTotalSize()}px`,
                    position: "relative",
                    width: "100%",
                  }}
                >
                  {virtualizer.getVirtualItems().map((virtualRow) => {
                    const deal = deals[virtualRow.index];
                    if (!deal) return null;
                    return (
                      <div
                        key={deal.id}
                        ref={virtualizer.measureElement}
                        data-index={virtualRow.index}
                        style={{
                          position: "absolute",
                          top: 0,
                          left: 0,
                          width: "100%",
                          transform: `translateY(${virtualRow.start}px)`,
                        }}
                      >
                        <DealCard deal={deal} index={virtualRow.index} />
                      </div>
                    );
                  })}
                </div>
              ) : (
                deals.map((deal, index) => (
                  <DealCard key={deal.id} deal={deal} index={index} />
                ))
              )}
              {hasMore ? (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="w-full"
                  disabled={isLoadingMore}
                  onClick={onLoadMore}
                >
                  {isLoadingMore ? "Loading…" : "Load more"}
                </Button>
              ) : null}
            </div>
            {droppableProvided.placeholder}
          </div>
        )}
      </Droppable>
    </div>
  );
};
