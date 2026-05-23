import type { DataProvider, Identifier } from "ra-core";

import type { Deal } from "../types";
import type { DealsByStage } from "./stages";

export const updateDealStageLocal = (
  sourceDeal: Deal,
  source: { stage: string; index: number },
  destination: {
    stage: string;
    index?: number;
  },
  dealsByStage: DealsByStage,
) => {
  if (source.stage === destination.stage) {
    const column = [...dealsByStage[source.stage]];
    column.splice(source.index, 1);
    column.splice(destination.index ?? column.length + 1, 0, sourceDeal);
    return {
      ...dealsByStage,
      [destination.stage]: column,
    };
  }

  const sourceColumn = [...dealsByStage[source.stage]];
  const destinationColumn = [...dealsByStage[destination.stage]];
  sourceColumn.splice(source.index, 1);
  destinationColumn.splice(
    destination.index ?? destinationColumn.length + 1,
    0,
    sourceDeal,
  );
  return {
    ...dealsByStage,
    [source.stage]: sourceColumn,
    [destination.stage]: destinationColumn,
  };
};

export const updateDealStage = async (
  source: Deal,
  destination: {
    stage: string;
    index?: number;
  },
  dataProvider: DataProvider,
  identityId?: Identifier,
): Promise<{ stageChanged: boolean; newStage?: string }> => {
  const pipelineId = source.pipeline_id || "default";
  const identity = identityId ? { id: identityId } : undefined;
  if (source.stage === destination.stage) {
    const { data: columnDeals } = await dataProvider.getList("deals", {
      sort: { field: "index", order: "ASC" },
      pagination: { page: 1, perPage: 100 },
      filter: { stage: source.stage, pipeline_id: pipelineId },
    });
    const destinationIndex = destination.index ?? columnDeals.length + 1;

    if (source.index > destinationIndex) {
      await Promise.all([
        ...columnDeals
          .filter(
            (deal) =>
              deal.index >= destinationIndex && deal.index < source.index,
          )
          .map((deal) =>
            dataProvider.update("deals", {
              id: deal.id,
              data: { index: deal.index + 1 },
              previousData: deal,
              meta: { identity },
            }),
          ),
        dataProvider.update("deals", {
          id: source.id,
          data: { index: destinationIndex },
          previousData: source,
          meta: { identity },
        }),
      ]);
    } else {
      await Promise.all([
        ...columnDeals
          .filter(
            (deal) =>
              deal.index <= destinationIndex && deal.index > source.index,
          )
          .map((deal) =>
            dataProvider.update("deals", {
              id: deal.id,
              data: { index: deal.index - 1 },
              previousData: deal,
              meta: { identity },
            }),
          ),
        dataProvider.update("deals", {
          id: source.id,
          data: { index: destinationIndex },
          previousData: source,
          meta: { identity },
        }),
      ]);
    }
    return { stageChanged: false };
  }

  const [{ data: sourceDeals }, { data: destinationDeals }] = await Promise.all([
    dataProvider.getList("deals", {
      sort: { field: "index", order: "ASC" },
      pagination: { page: 1, perPage: 100 },
      filter: { stage: source.stage, pipeline_id: pipelineId },
    }),
    dataProvider.getList("deals", {
      sort: { field: "index", order: "ASC" },
      pagination: { page: 1, perPage: 100 },
      filter: { stage: destination.stage, pipeline_id: pipelineId },
    }),
  ]);
  const destinationIndex = destination.index ?? destinationDeals.length + 1;

  await Promise.all([
    ...sourceDeals
      .filter((deal) => deal.index > source.index)
      .map((deal) =>
        dataProvider.update("deals", {
          id: deal.id,
          data: { index: deal.index - 1 },
          previousData: deal,
          meta: { identity },
        }),
      ),
    ...destinationDeals
      .filter((deal) => deal.index >= destinationIndex)
      .map((deal) =>
        dataProvider.update("deals", {
          id: deal.id,
          data: { index: deal.index + 1 },
          previousData: deal,
          meta: { identity },
        }),
      ),
    dataProvider.update("deals", {
      id: source.id,
      data: {
        index: destinationIndex,
        stage: destination.stage,
      },
      previousData: source,
      meta: { identity },
    }),
  ]);
  return { stageChanged: true, newStage: destination.stage };
};
