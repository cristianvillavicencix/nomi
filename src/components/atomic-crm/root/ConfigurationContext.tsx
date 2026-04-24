import { useMemo } from "react";
import { useStore } from "ra-core";

import type {
  DealPipeline,
  DealPipelineStage,
  DealStage,
  LabeledValue,
  NoteStatus,
} from "../types";
import { defaultConfiguration, withCurrentProductName } from "./defaultConfiguration";
import { type PayrollSettings } from "@/payroll/rules";

export const CONFIGURATION_STORE_KEY = "app.configuration";

export interface ConfigurationContextValue {
  companySectors: LabeledValue[];
  companyLegalName?: string;
  companyTaxId?: string;
  companyAddressLine1?: string;
  companyAddressLine2?: string;
  companyCity?: string;
  companyState?: string;
  companyPostalCode?: string;
  companyCountry?: string;
  companyPhone?: string;
  companyEmail?: string;
  companyRepresentativeName?: string;
  companyRepresentativeTitle?: string;
  dealCategories: LabeledValue[];
  dealPipelineStatuses: string[];
  dealStages: DealStage[];
  dealPipelines: DealPipeline[];
  projectsView?: "board" | "list";
  noteStatuses: NoteStatus[];
  taskTypes: LabeledValue[];
  title: string;
  darkModeLogo: string;
  lightModeLogo: string;
  payrollSettings?: PayrollSettings;
  googleWorkplaceDomain?: string;
  disableEmailPasswordAuthentication?: boolean;
}

const normalizeDealPipelines = (
  config: Partial<ConfigurationContextValue>,
): DealPipeline[] => {
  const maybePipelines = config.dealPipelines;
  if (Array.isArray(maybePipelines) && maybePipelines.length > 0) {
    return maybePipelines
      .map((pipeline, pipelineIndex) => {
        const normalizedId =
          pipeline.id || `pipeline-${pipelineIndex + 1}`;
        const stages = (pipeline.stages ?? [])
          .map((stage, stageIndex) => ({
            id: stage.id || `stage-${stageIndex + 1}`,
            label: stage.label || stage.id || `Stage ${stageIndex + 1}`,
            color: stage.color || "#64748b",
            order: stage.order ?? stageIndex + 1,
            pipelineId: normalizedId,
            isDefault: !!stage.isDefault,
          }))
          .sort((left, right) => left.order - right.order);

        return {
          id: normalizedId,
          label: pipeline.label || `Pipeline ${pipelineIndex + 1}`,
          order: pipeline.order ?? pipelineIndex + 1,
          isDefault: !!pipeline.isDefault || pipelineIndex === 0,
          stages,
        };
      })
      .sort((left, right) => left.order - right.order);
  }

  const legacyStages =
    config.dealStages && config.dealStages.length > 0
      ? config.dealStages
      : defaultConfiguration.dealStages;
  const legacyPipelineStatuses =
    config.dealPipelineStatuses && config.dealPipelineStatuses.length > 0
      ? config.dealPipelineStatuses
      : defaultConfiguration.dealPipelineStatuses;

  return [
    {
      id: "default",
      label: "Default Board",
      order: 1,
      isDefault: true,
      stages: legacyStages.map((stage, index) => ({
        id: stage.value,
        label: stage.label,
        color: legacyPipelineStatuses.includes(stage.value)
          ? "#16a34a"
          : "#64748b",
        order: index + 1,
        pipelineId: "default",
        isDefault: index === 0,
      })),
    },
  ];
};

const getDefaultPipeline = (pipelines: DealPipeline[]) =>
  pipelines.find((pipeline) => pipeline.isDefault) ?? pipelines[0];

const toLegacyDealStages = (stages: DealPipelineStage[]): DealStage[] =>
  stages.map((stage) => ({ value: stage.id, label: stage.label }));

const toLegacyPipelineStatuses = (stages: DealPipelineStage[]): string[] =>
  stages
    .filter(
      (stage) =>
        stage.id === "won" ||
        stage.label.toLowerCase().includes("won") ||
        stage.label.toLowerCase().includes("closed"),
    )
    .map((stage) => stage.id);

export const useConfigurationContext = () => {
  const [config] = useStore<ConfigurationContextValue>(
    CONFIGURATION_STORE_KEY,
    defaultConfiguration,
  );
  // Merge with defaults so that missing fields in stored config
  // fall back to default values (e.g. when new settings are added)
  return useMemo(() => {
    const merged = withCurrentProductName({
      ...defaultConfiguration,
      ...config,
    });
    const dealPipelines = normalizeDealPipelines(merged);
    const defaultPipeline = getDefaultPipeline(dealPipelines);
    const defaultStages = defaultPipeline?.stages ?? [];

    return {
      ...merged,
      dealPipelines,
      dealStages: toLegacyDealStages(defaultStages),
      dealPipelineStatuses: toLegacyPipelineStatuses(defaultStages),
    };
  }, [config]);
};

export const useConfigurationUpdater = () => {
  const [, setConfig] = useStore<ConfigurationContextValue>(
    CONFIGURATION_STORE_KEY,
  );
  return setConfig;
};
