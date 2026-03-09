import type { ConfigurationContextValue } from "../root/ConfigurationContext";
import type { Deal, DealPipeline, DealPipelineStage } from "../types";

export const getDefaultPipeline = (
  config: Pick<ConfigurationContextValue, "dealPipelines">,
): DealPipeline | undefined =>
  config.dealPipelines.find((pipeline) => pipeline.isDefault) ??
  config.dealPipelines[0];

export const getDealPipelineId = (
  deal: Pick<Deal, "pipeline_id"> | undefined,
  config: Pick<ConfigurationContextValue, "dealPipelines">,
) => deal?.pipeline_id || getDefaultPipeline(config)?.id || "default";

export const getPipelineById = (
  config: Pick<ConfigurationContextValue, "dealPipelines">,
  pipelineId?: string,
): DealPipeline | undefined => {
  const targetId = pipelineId || getDefaultPipeline(config)?.id;
  return config.dealPipelines.find((pipeline) => pipeline.id === targetId);
};

export const getPipelineStages = (
  config: Pick<ConfigurationContextValue, "dealPipelines">,
  pipelineId?: string,
): DealPipelineStage[] => getPipelineById(config, pipelineId)?.stages ?? [];

export const getStage = (
  config: Pick<ConfigurationContextValue, "dealPipelines">,
  stageId?: string,
  pipelineId?: string,
): DealPipelineStage | undefined =>
  getPipelineStages(config, pipelineId).find((stage) => stage.id === stageId);

export const getStageLabel = (
  config: Pick<ConfigurationContextValue, "dealPipelines">,
  stageId?: string,
  pipelineId?: string,
) => getStage(config, stageId, pipelineId)?.label ?? stageId ?? "—";

export const getStageColor = (
  config: Pick<ConfigurationContextValue, "dealPipelines">,
  stageId?: string,
  pipelineId?: string,
) => getStage(config, stageId, pipelineId)?.color ?? "#64748b";

export const toStageChoices = (stages: DealPipelineStage[]) =>
  stages.map((stage) => ({ value: stage.id, label: stage.label }));
