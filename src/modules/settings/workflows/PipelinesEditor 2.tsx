import { useState } from "react";
import type { RaRecord } from "ra-core";
import { Button } from "@/components/ui/button";
import { toSlug } from "@/lib/toSlug";
import type { DealPipeline, DealPipelineStage } from "@/components/atomic-crm/types";

export const PipelinesEditor = ({
  pipelines,
  onChange,
  deals,
}: {
  pipelines: DealPipeline[];
  onChange: (pipelines: DealPipeline[]) => void;
  deals?: RaRecord[];
}) => {
  const [selectedPipelineId, setSelectedPipelineId] = useState(
    () => pipelines[0]?.id ?? "default",
  );
  const selectedPipeline =
    pipelines.find((pipeline) => pipeline.id === selectedPipelineId) ??
    pipelines[0];

  const replacePipeline = (nextPipeline: DealPipeline) => {
    onChange(
      pipelines.map((pipeline) =>
        pipeline.id === nextPipeline.id ? nextPipeline : pipeline,
      ),
    );
  };

  const addPipeline = () => {
    const id = `pipeline-${Date.now()}`;
    const nextPipeline: DealPipeline = {
      id,
      label: "New Pipeline",
      order: pipelines.length + 1,
      stages: [
        {
          id: "new",
          label: "New",
          color: "#64748b",
          order: 1,
          pipelineId: id,
          isDefault: true,
        },
      ],
      isDefault: pipelines.length === 0,
    };
    onChange([...pipelines, nextPipeline]);
    setSelectedPipelineId(id);
  };

  const deletePipeline = () => {
    if (!selectedPipeline) return;
    if (pipelines.length <= 1) return;
    const next = pipelines.filter(
      (pipeline) => pipeline.id !== selectedPipeline.id,
    );
    onChange(next);
    setSelectedPipelineId(next[0].id);
  };

  const movePipeline = (direction: "up" | "down") => {
    if (!selectedPipeline) return;
    const index = pipelines.findIndex(
      (pipeline) => pipeline.id === selectedPipeline.id,
    );
    const nextIndex = direction === "up" ? index - 1 : index + 1;
    if (index < 0 || nextIndex < 0 || nextIndex >= pipelines.length) return;
    const reordered = [...pipelines];
    const [moved] = reordered.splice(index, 1);
    reordered.splice(nextIndex, 0, moved);
    onChange(
      reordered.map((pipeline, orderIndex) => ({
        ...pipeline,
        order: orderIndex + 1,
        isDefault: orderIndex === 0 ? true : pipeline.isDefault,
      })),
    );
  };

  const addStage = () => {
    if (!selectedPipeline) return;
    const nextStage: DealPipelineStage = {
      id: `stage-${Date.now()}`,
      label: "New Stage",
      color: "#64748b",
      order: selectedPipeline.stages.length + 1,
      pipelineId: selectedPipeline.id,
    };
    replacePipeline({
      ...selectedPipeline,
      stages: [...selectedPipeline.stages, nextStage],
    });
  };

  const updateStage = (stageId: string, patch: Partial<DealPipelineStage>) => {
    if (!selectedPipeline) return;
    replacePipeline({
      ...selectedPipeline,
      stages: selectedPipeline.stages.map((stage) =>
        stage.id === stageId ? { ...stage, ...patch } : stage,
      ),
    });
  };

  const swapStage = (fromIndex: number, toIndex: number) => {
    if (!selectedPipeline) return;
    if (toIndex < 0 || toIndex >= selectedPipeline.stages.length) return;
    const stages = [...selectedPipeline.stages];
    const [moved] = stages.splice(fromIndex, 1);
    stages.splice(toIndex, 0, moved);
    replacePipeline({
      ...selectedPipeline,
      stages: stages.map((stage, index) => ({ ...stage, order: index + 1 })),
    });
  };

  const removeStage = (stage: DealPipelineStage) => {
    if (!selectedPipeline) return;
    const stageInUse =
      deals?.some(
        (deal) =>
          (deal.pipeline_id || selectedPipeline.id) === selectedPipeline.id &&
          deal.stage === stage.id,
      ) ?? false;
    if (stageInUse) {
      window.alert(
        "This stage is in use by projects. Reassign them before deleting.",
      );
      return;
    }
    replacePipeline({
      ...selectedPipeline,
      stages: selectedPipeline.stages
        .filter((item) => item.id !== stage.id)
        .map((item, index) => ({ ...item, order: index + 1 })),
    });
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <Button type="button" size="sm" variant="secondary" onClick={addPipeline}>
          Add pipeline
        </Button>
        <Button
          type="button"
          size="sm"
          variant="secondary"
          onClick={deletePipeline}
          disabled={pipelines.length <= 1}
        >
          Delete
        </Button>
        <Button
          type="button"
          size="sm"
          variant="secondary"
          onClick={() => movePipeline("up")}
          disabled={
            pipelines.findIndex(
              (pipeline) => pipeline.id === selectedPipeline?.id,
            ) <= 0
          }
        >
          Up
        </Button>
        <Button
          type="button"
          size="sm"
          variant="secondary"
          onClick={() => movePipeline("down")}
          disabled={
            pipelines.findIndex(
              (pipeline) => pipeline.id === selectedPipeline?.id,
            ) >=
            pipelines.length - 1
          }
        >
          Down
        </Button>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <select
          className="h-9 rounded-md border border-input bg-background px-3 text-sm"
          value={selectedPipeline?.id}
          onChange={(event) => setSelectedPipelineId(event.target.value)}
        >
          {pipelines.map((pipeline) => (
            <option key={pipeline.id} value={pipeline.id}>
              {pipeline.label}
            </option>
          ))}
        </select>
        <input
          className="h-9 min-w-[12rem] flex-1 rounded-md border border-input bg-background px-3 text-sm"
          value={selectedPipeline?.label ?? ""}
          onChange={(event) =>
            selectedPipeline &&
            replacePipeline({ ...selectedPipeline, label: event.target.value })
          }
          placeholder="Pipeline name"
        />
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <p className="text-sm font-medium">Stages</p>
          <Button type="button" size="sm" variant="secondary" onClick={addStage}>
            Add stage
          </Button>
        </div>
        {(selectedPipeline?.stages ?? []).map((stage, index) => (
          <div
            key={stage.id}
            className="grid grid-cols-[1fr_auto_auto_auto] items-center gap-2"
          >
            <input
              className="h-9 rounded-md border border-input bg-background px-3 text-sm"
              value={stage.label}
              onChange={(event) =>
                updateStage(stage.id, {
                  label: event.target.value,
                  id: toSlug(event.target.value || stage.id),
                })
              }
              placeholder="Stage label"
            />
            <input
              type="color"
              value={stage.color || "#64748b"}
              onChange={(event) =>
                updateStage(stage.id, { color: event.target.value })
              }
              className="h-9 w-10 rounded-md border border-input bg-background p-1"
              aria-label="Stage color"
            />
            <div className="flex gap-1">
              <Button
                type="button"
                size="sm"
                variant="secondary"
                onClick={() => swapStage(index, index - 1)}
                disabled={index === 0}
              >
                ↑
              </Button>
              <Button
                type="button"
                size="sm"
                variant="secondary"
                onClick={() => swapStage(index, index + 1)}
                disabled={index === (selectedPipeline?.stages.length ?? 0) - 1}
              >
                ↓
              </Button>
            </div>
            <Button
              type="button"
              size="sm"
              variant="secondary"
              onClick={() => removeStage(stage)}
            >
              Delete
            </Button>
          </div>
        ))}
      </div>
    </div>
  );
};
