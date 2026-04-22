import { Droppable } from "@hello-pangea/dnd";

import { useConfigurationContext } from "../root/ConfigurationContext";
import type { Deal } from "../types";
import { getStageColor, getStageLabel } from "./pipelines";
import { DealCard } from "./DealCard";

export const DealColumn = ({
  stage,
  deals,
  pipelineId,
}: {
  stage: string;
  deals: Deal[];
  pipelineId: string;
}) => {
  const totalAmount = deals.reduce((sum, deal) => sum + deal.amount, 0);

  const config = useConfigurationContext();
  const stageColor = getStageColor(config, stage, pipelineId);
  return (
    <div className="flex-1 pb-8">
      <div className="flex flex-col items-center">
        <h3 className="flex items-center gap-2 text-base font-medium">
          <span
            className="h-2.5 w-2.5 rounded-full"
            style={{ backgroundColor: stageColor }}
          />
          {getStageLabel(config, stage, pipelineId)}
        </h3>
        <p className="text-sm text-muted-foreground">
          {totalAmount.toLocaleString("en-US", {
            notation: "compact",
            style: "currency",
            currency: "USD",
            currencyDisplay: "narrowSymbol",
            minimumSignificantDigits: 3,
          })}
        </p>
      </div>
      <Droppable droppableId={stage}>
        {(droppableProvided, snapshot) => (
          <div
            ref={droppableProvided.innerRef}
            {...droppableProvided.droppableProps}
            className={`flex flex-col rounded-2xl mt-2 gap-2 ${
              snapshot.isDraggingOver ? "bg-muted" : ""
            }`}
          >
            {deals.map((deal, index) => (
              <DealCard key={deal.id} deal={deal} index={index} />
            ))}
            {droppableProvided.placeholder}
          </div>
        )}
      </Droppable>
    </div>
  );
};
