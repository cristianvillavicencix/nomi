import { useMemo } from "react";
import { useGetList } from "ra-core";

import {
  useConfigurationContext,
  type ConfigurationContextValue,
} from "@/components/atomic-crm/root/ConfigurationContext";
import type {
  DealPipeline,
  DealPipelineStage,
  DealStage,
  OrganizationPipelineStage,
} from "@/components/atomic-crm/types";
import { isLbsMode } from "@/lbs/productMode";

const toLegacyDealStages = (stages: DealPipelineStage[]): DealStage[] =>
  stages.map((stage) => ({ value: stage.id, label: stage.label }));

const toLegacyPipelineStatuses = (stages: DealPipelineStage[]): string[] =>
  stages
    .filter(
      (stage) =>
        stage.id === "won" ||
        stage.id === "closed_won" ||
        stage.id === "delivered" ||
        stage.label.toLowerCase().includes("won") ||
        stage.label.toLowerCase().includes("closed won"),
    )
    .map((stage) => stage.id);

const mergeOrgStagesIntoConfig = (
  config: ConfigurationContextValue,
  orgStages: OrganizationPipelineStage[],
): ConfigurationContextValue => {
  if (orgStages.length === 0) return config;

  const stagesByPipeline = orgStages.reduce<
    Record<string, OrganizationPipelineStage[]>
  >((acc, row) => {
    const pipelineId = row.pipeline_id || "default";
    acc[pipelineId] = acc[pipelineId] ?? [];
    acc[pipelineId].push(row);
    return acc;
  }, {});

  const dealPipelines = config.dealPipelines.map((pipeline) => {
    const rows = stagesByPipeline[pipeline.id];
    if (!rows?.length) return pipeline;

    const stages = [...rows]
      .sort((left, right) => left.order_index - right.order_index)
      .map(
        (row, index): DealPipelineStage => ({
          id: row.key,
          label: row.label,
          color: row.color || "#64748b",
          order: row.order_index || index + 1,
          pipelineId: pipeline.id,
          isDefault: row.order_index === 1,
        }),
      );

    return { ...pipeline, stages };
  });

  const defaultPipeline =
    dealPipelines.find((pipeline) => pipeline.isDefault) ?? dealPipelines[0];
  const defaultStages = defaultPipeline?.stages ?? [];

  return {
    ...config,
    dealPipelines,
    dealStages: toLegacyDealStages(defaultStages),
    dealPipelineStatuses: toLegacyPipelineStatuses(defaultStages),
  };
};

export const useLbsPipelineConfig = (): ConfigurationContextValue => {
  const config = useConfigurationContext();
  const lbsMode = isLbsMode();

  const { data: orgStages = [], isSuccess } =
    useGetList<OrganizationPipelineStage>("organization_pipeline_stages", {
      pagination: { page: 1, perPage: 200 },
      sort: { field: "order_index", order: "ASC" },
    });

  return useMemo(() => {
    if (!lbsMode || !isSuccess) return config;
    return mergeOrgStagesIntoConfig(config, orgStages);
  }, [config, isSuccess, lbsMode, orgStages]);
};
