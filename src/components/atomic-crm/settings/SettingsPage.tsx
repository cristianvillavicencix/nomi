import { RotateCcw, Save } from "lucide-react";
import type { RaRecord } from "ra-core";
import { EditBase, Form, useGetList, useInput, useNotify } from "ra-core";
import { useCallback, useMemo, useState } from "react";
import { useFormContext } from "react-hook-form";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { toSlug } from "@/lib/toSlug";
import { ArrayInput } from "@/components/admin/array-input";
import { SimpleFormIterator } from "@/components/admin/simple-form-iterator";
import { TextInput } from "@/components/admin/text-input";

import ImageEditorField from "../misc/ImageEditorField";
import {
  useConfigurationContext,
  useConfigurationUpdater,
  type ConfigurationContextValue,
} from "../root/ConfigurationContext";
import { defaultConfiguration } from "../root/defaultConfiguration";
import type { DealPipeline, DealPipelineStage } from "../types";

const SECTIONS = [
  { id: "branding", label: "Branding" },
  { id: "companies", label: "Companies" },
  { id: "deals", label: "Projects" },
  { id: "notes", label: "Notes" },
  { id: "tasks", label: "Tasks" },
];

/** Ensure every item in a { value, label } array has a value (slug from label). */
const ensureValues = (items: { value?: string; label: string }[] | undefined) =>
  items?.map((item) => ({ ...item, value: item.value || toSlug(item.label) }));

/**
 * Validate that no items were removed if they are still referenced by existing deals.
 * Also rejects duplicate slug values.
 * Returns undefined if valid, or an error message string.
 */
export const validateItemsInUse = (
  items: { value: string; label: string }[] | undefined,
  deals: RaRecord[] | undefined,
  fieldName: string,
  displayName: string,
) => {
  if (!items) return undefined;
  // Check for duplicate slugs
  const slugs = items.map((i) => i.value || toSlug(i.label));
  const seen = new Set<string>();
  const duplicates = new Set<string>();
  for (const slug of slugs) {
    if (seen.has(slug)) duplicates.add(slug);
    seen.add(slug);
  }
  if (duplicates.size > 0) {
    return `Duplicate ${displayName}: ${[...duplicates].join(", ")}`;
  }
  // Check that no in-use value was removed (skip if deals haven't loaded)
  if (!deals) return "Validating…";
  const values = new Set(slugs);
  const inUse = [
    ...new Set(
      deals
        .filter(
          (deal) => deal[fieldName] && !values.has(deal[fieldName] as string),
        )
        .map((deal) => deal[fieldName] as string),
    ),
  ];
  if (inUse.length > 0) {
    return `Cannot remove ${displayName} that are still used by projects: ${inUse.join(", ")}`;
  }
  return undefined;
};

const transformFormValues = (data: Record<string, any>) => ({
  config: {
    title: data.title,
    lightModeLogo: data.lightModeLogo,
    darkModeLogo: data.darkModeLogo,
    companySectors: ensureValues(data.companySectors),
    dealCategories: ensureValues(data.dealCategories),
    taskTypes: ensureValues(data.taskTypes),
    dealPipelines: (data.dealPipelines ?? []).map(
      (pipeline: DealPipeline, pipelineIndex: number) => ({
        ...pipeline,
        id: pipeline.id || `pipeline-${pipelineIndex + 1}`,
        order: pipeline.order ?? pipelineIndex + 1,
        stages: (pipeline.stages ?? []).map(
          (stage: DealPipelineStage, stageIndex: number) => ({
            ...stage,
            id: stage.id || toSlug(stage.label || `stage-${stageIndex + 1}`),
            label: stage.label || `Stage ${stageIndex + 1}`,
            color: stage.color || "#64748b",
            order: stage.order ?? stageIndex + 1,
            pipelineId:
              pipeline.id || `pipeline-${pipelineIndex + 1}`,
          }),
        ),
      }),
    ),
    dealStages: ensureValues(data.dealStages),
    dealPipelineStatuses: data.dealPipelineStatuses,
    noteStatuses: ensureValues(data.noteStatuses),
  } as ConfigurationContextValue,
});

export const SettingsPage = () => {
  const updateConfiguration = useConfigurationUpdater();
  const notify = useNotify();

  return (
    <EditBase
      resource="configuration"
      id={1}
      mutationMode="pessimistic"
      redirect={false}
      transform={transformFormValues}
      mutationOptions={{
        onSuccess: (data: any) => {
          updateConfiguration(data.config);
          notify("Configuration saved successfully");
        },
        onError: () => {
          notify("Failed to save configuration", { type: "error" });
        },
      }}
    >
      <SettingsForm />
    </EditBase>
  );
};

SettingsPage.path = "/settings";

const SettingsForm = () => {
  const config = useConfigurationContext();

  const defaultValues = useMemo(
    () => ({
      title: config.title,
      lightModeLogo: { src: config.lightModeLogo },
      darkModeLogo: { src: config.darkModeLogo },
      companySectors: config.companySectors,
      dealCategories: config.dealCategories,
      taskTypes: config.taskTypes,
      dealPipelines: config.dealPipelines,
      dealStages: config.dealStages,
      dealPipelineStatuses: config.dealPipelineStatuses,
      noteStatuses: config.noteStatuses,
    }),
    [config],
  );

  return (
    <Form defaultValues={defaultValues}>
      <SettingsFormFields />
    </Form>
  );
};

const SettingsFormFields = () => {
  const {
    watch,
    setValue,
    reset,
    formState: { isSubmitting },
  } = useFormContext();

  const dealPipelines: DealPipeline[] = watch("dealPipelines") ?? [];

  const { data: deals } = useGetList("deals", {
    pagination: { page: 1, perPage: 1000 },
  });

  const validateDealCategories = useCallback(
    (categories: { value: string; label: string }[] | undefined) =>
      validateItemsInUse(categories, deals, "category", "categories"),
    [deals],
  );

  return (
    <div className="flex gap-8 mt-4 pb-20">
      {/* Left navigation */}
      <nav className="hidden md:block w-48 shrink-0">
        <div className="sticky top-4 space-y-1">
          <h1 className="text-2xl font-semibold px-3 mb-2">Settings</h1>
          {SECTIONS.map((section) => (
            <button
              key={section.id}
              type="button"
              onClick={() => {
                document
                  .getElementById(section.id)
                  ?.scrollIntoView({ behavior: "smooth" });
              }}
              className="block w-full text-left px-3 py-1 text-sm rounded-md hover:text-foreground hover:bg-muted transition-colors"
            >
              {section.label}
            </button>
          ))}
        </div>
      </nav>

      {/* Main content */}
      <div className="flex-1 min-w-0 max-w-2xl space-y-6">
        {/* Branding */}
        <Card id="branding">
          <CardContent className="space-y-4">
            <h2 className="text-xl font-semibold text-muted-foreground">
              Branding
            </h2>
            <TextInput source="title" label="App Title" />
            <div className="flex gap-8">
              <div className="flex flex-col items-center gap-1">
                <p className="text-sm text-muted-foreground">Light Mode Logo</p>
                <ImageEditorField
                  source="lightModeLogo"
                  width={100}
                  height={100}
                  linkPosition="bottom"
                  backgroundImageColor="#f5f5f5"
                />
              </div>
              <div className="flex flex-col items-center gap-1">
                <p className="text-sm text-muted-foreground">Dark Mode Logo</p>
                <ImageEditorField
                  source="darkModeLogo"
                  width={100}
                  height={100}
                  linkPosition="bottom"
                  backgroundImageColor="#1a1a1a"
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Companies */}
        <Card id="companies">
          <CardContent className="space-y-4">
            <h2 className="text-xl font-semibold text-muted-foreground">
              Companies
            </h2>
            <h3 className="text-lg font-medium text-muted-foreground">
              Sectors
            </h3>
            <ArrayInput
              source="companySectors"
              label={false}
              helperText={false}
            >
              <SimpleFormIterator disableReordering disableClear>
                <TextInput source="label" label={false} />
              </SimpleFormIterator>
            </ArrayInput>
          </CardContent>
        </Card>

        {/* Projects */}
        <Card id="deals">
          <CardContent className="space-y-4">
            <h2 className="text-xl font-semibold text-muted-foreground">
              Projects
            </h2>
            <PipelinesEditor
              pipelines={dealPipelines}
              onChange={(pipelines) => setValue("dealPipelines", pipelines)}
              deals={deals}
            />

            <Separator />

            <h3 className="text-lg font-medium text-muted-foreground">
              Categories
            </h3>
            <ArrayInput
              source="dealCategories"
              label={false}
              helperText={false}
              validate={validateDealCategories}
            >
              <SimpleFormIterator disableReordering disableClear>
                <TextInput source="label" label={false} />
              </SimpleFormIterator>
            </ArrayInput>
          </CardContent>
        </Card>

        {/* Notes */}
        <Card id="notes">
          <CardContent className="space-y-4">
            <h2 className="text-xl font-semibold text-muted-foreground">
              Notes
            </h2>
            <h3 className="text-lg font-medium text-muted-foreground">
              Statuses
            </h3>
            <ArrayInput source="noteStatuses" label={false} helperText={false}>
              <SimpleFormIterator inline disableReordering disableClear>
                <TextInput source="label" label={false} className="flex-1" />
                <ColorInput source="color" />
              </SimpleFormIterator>
            </ArrayInput>
          </CardContent>
        </Card>

        {/* Tasks */}
        <Card id="tasks">
          <CardContent className="space-y-4">
            <h2 className="text-xl font-semibold text-muted-foreground">
              Tasks
            </h2>
            <h3 className="text-lg font-medium text-muted-foreground">Types</h3>
            <ArrayInput source="taskTypes" label={false} helperText={false}>
              <SimpleFormIterator disableReordering disableClear>
                <TextInput source="label" label={false} />
              </SimpleFormIterator>
            </ArrayInput>
          </CardContent>
        </Card>
      </div>

      {/* Sticky save button */}
      <div className="fixed bottom-0 left-0 right-0 border-t bg-background p-4">
        <div className="max-w-screen-xl mx-auto flex gap-8 px-4">
          <div className="hidden md:block w-48 shrink-0" />
          <div className="flex-1 min-w-0 max-w-2xl flex justify-between">
            <Button
              type="button"
              variant="ghost"
              onClick={() =>
                reset({
                  ...defaultConfiguration,
                  lightModeLogo: {
                    src: defaultConfiguration.lightModeLogo,
                  },
                  darkModeLogo: { src: defaultConfiguration.darkModeLogo },
                })
              }
            >
              <RotateCcw className="h-4 w-4 mr-1" />
              Reset to Defaults
            </Button>
            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => window.history.back()}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                <Save className="h-4 w-4 mr-1" />
                {isSubmitting ? "Saving..." : "Save"}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

const PipelinesEditor = ({
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
    const next = pipelines.filter((pipeline) => pipeline.id !== selectedPipeline.id);
    onChange(next);
    setSelectedPipelineId(next[0].id);
  };

  const movePipeline = (direction: "up" | "down") => {
    if (!selectedPipeline) return;
    const index = pipelines.findIndex((pipeline) => pipeline.id === selectedPipeline.id);
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
        "This stage is currently used by projects. Reassign those projects before deleting it.",
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
      <div className="flex items-center gap-2">
        <h3 className="text-lg font-medium text-muted-foreground">Pipelines</h3>
        <Button type="button" size="sm" variant="outline" onClick={addPipeline}>
          Add Pipeline
        </Button>
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={deletePipeline}
          disabled={pipelines.length <= 1}
        >
          Delete Pipeline
        </Button>
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={() => movePipeline("up")}
          disabled={
            pipelines.findIndex((pipeline) => pipeline.id === selectedPipeline?.id) <= 0
          }
        >
          Move Up
        </Button>
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={() => movePipeline("down")}
          disabled={
            pipelines.findIndex((pipeline) => pipeline.id === selectedPipeline?.id) >=
            pipelines.length - 1
          }
        >
          Move Down
        </Button>
      </div>
      <div className="flex items-center gap-2">
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
          className="h-9 rounded-md border border-input bg-background px-3 text-sm"
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
          <h4 className="text-sm font-medium text-muted-foreground">Stages</h4>
          <Button type="button" size="sm" variant="outline" onClick={addStage}>
            Add Stage
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
              onChange={(event) => updateStage(stage.id, { color: event.target.value })}
              className="h-9 w-10 rounded-md border border-input bg-background p-1"
            />
            <div className="flex gap-1">
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => swapStage(index, index - 1)}
                disabled={index === 0}
              >
                ↑
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => swapStage(index, index + 1)}
                disabled={index === (selectedPipeline?.stages.length ?? 0) - 1}
              >
                ↓
              </Button>
            </div>
            <Button
              type="button"
              size="sm"
              variant="outline"
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

/** A minimal color picker input compatible with ra-core's useInput. */
const ColorInput = ({ source }: { source: string }) => {
  const { field } = useInput({ source });
  return (
    <input
      type="color"
      {...field}
      value={field.value || "#000000"}
      className="w-9 h-9 shrink-0 cursor-pointer appearance-none rounded border bg-transparent p-0.5 [&::-webkit-color-swatch-wrapper]:cursor-pointer [&::-webkit-color-swatch-wrapper]:p-0 [&::-webkit-color-swatch]:cursor-pointer [&::-webkit-color-swatch]:rounded-sm [&::-webkit-color-swatch]:border-none [&::-moz-color-swatch]:cursor-pointer [&::-moz-color-swatch]:rounded-sm [&::-moz-color-swatch]:border-none"
    />
  );
};
