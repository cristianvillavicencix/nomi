import { Droppable } from "@hello-pangea/dnd";
import { useVirtualizer } from "@tanstack/react-virtual";
import { useRef } from "react";

import { Button } from "@/components/ui/button";
import { MoneyText } from "@/lib/permissions/MoneyText";
import { useCanViewAmounts } from "@/lib/permissions/useMaskedAmount";
import { cn } from "@/lib/utils";
import { useConfigurationContext } from "../root/ConfigurationContext";
import type { Deal } from "../types";
import { getStageColor, getStageLabel } from "./pipelines";
import { DealCard } from "./DealCard";

const VIRTUAL_SCROLL_THRESHOLD = 30;
const ESTIMATED_CARD_HEIGHT = 118;

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
  const stageLabel = getStageLabel(config, stage, pipelineId);
  const scrollRef = useRef<HTMLDivElement>(null);
  const useVirtual =
    !isDragging && deals.length > VIRTUAL_SCROLL_THRESHOLD && !hasMore;

  const virtualizer = useVirtualizer({
    count: deals.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => ESTIMATED_CARD_HEIGHT,
    overscan: 4,
  });

  const countLabel =
    totalCount != null && totalCount !== deals.length
      ? `${deals.length} of ${totalCount}`
      : String(deals.length);

  return (
    <div className="flex h-full w-[280px] shrink-0 flex-col min-h-0">
      <div
        data-kanban-header
        className="mb-2 shrink-0 flex flex-col items-center text-center select-none"
      >
        <h3 className="flex items-center gap-2 text-sm font-semibold">
          <span
            className="h-2.5 w-2.5 rounded-full"
            style={{ backgroundColor: stageColor }}
          />
          {stageLabel}
        </h3>
        <p className="text-[11px] text-muted-foreground">
          {countLabel} {Number(countLabel) === 1 ? "project" : "projects"}
        </p>
        {canViewAmounts ? (
          <p className="text-[11px] text-muted-foreground">
            <MoneyText value={totalAmount} compact />
          </p>
        ) : null}
      </div>

      <div className="flex min-h-0 flex-1 flex-col">
        <Droppable droppableId={stage}>
          {(droppableProvided, snapshot) => (
            <div
              ref={droppableProvided.innerRef}
              {...droppableProvided.droppableProps}
              className="flex min-h-0 flex-1 flex-col"
            >
              <div
                ref={scrollRef}
                data-kanban-cards
                data-column-scroll
                className={cn(
                  "flex min-h-0 flex-1 flex-col gap-1.5 overflow-y-auto overscroll-y-contain rounded-xl border bg-muted/20 p-2 transition-colors",
                  snapshot.isDraggingOver
                    ? "border-primary/50 bg-primary/5"
                    : "border-transparent",
                )}
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

                {deals.length === 0 ? (
                  <p className="px-2 py-6 text-center text-xs text-muted-foreground">
                    Drop a project here to move to{" "}
                    <span className="font-medium">{stageLabel}</span>
                  </p>
                ) : null}

                {hasMore ? (
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    className="h-8 w-full text-xs"
                    disabled={isLoadingMore}
                    onClick={onLoadMore}
                  >
                    {isLoadingMore ? "Loading…" : "Load more"}
                  </Button>
                ) : null}

                {droppableProvided.placeholder}
              </div>
            </div>
          )}
        </Droppable>
      </div>
    </div>
  );
};
