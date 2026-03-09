import { Search, SlidersHorizontal } from "lucide-react";
import { useEffect, useState } from "react";
import {
  useDataProvider,
  useGetIdentity,
  useListContext,
  useListFilterContext,
  useNotify,
} from "ra-core";
import { matchPath, useLocation } from "react-router";
import { AutocompleteInput } from "@/components/admin/autocomplete-input";
import { CreateButton } from "@/components/admin/create-button";
import { ExportButton } from "@/components/admin/export-button";
import { List } from "@/components/admin/list";
import { ReferenceInput } from "@/components/admin/reference-input";
import { FilterButton } from "@/components/admin/filter-form";
import { SelectInput } from "@/components/admin/select-input";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";

import { useConfigurationContext } from "../root/ConfigurationContext";
import { useConfigurationUpdater } from "../root/ConfigurationContext";
import { DealArchivedList } from "./DealArchivedList";
import { DealCreate } from "./DealCreate";
import { DealEdit } from "./DealEdit";
import { DealEmpty } from "./DealEmpty";
import { DealListContent } from "./DealListContent";
import { DealTableView } from "./DealTableView";
import { DealShow } from "./DealShow";
import { getDefaultPipeline, getPipelineById } from "./pipelines";
import { useDealsViewPreference } from "./useDealsViewPreference";

const DealList = () => {
  const location = useLocation();
  const matchShow = matchPath("/deals/:id/show", location.pathname);
  const { identity } = useGetIdentity();
  const { dealCategories } = useConfigurationContext();

  if (!identity) return null;
  if (matchShow) {
    return <DealShow id={matchShow.params.id} />;
  }

  const dealFilters = [
    <ReferenceInput source="company_id" reference="companies">
      <AutocompleteInput label={false} placeholder="Company" />
    </ReferenceInput>,
    <SelectInput
      source="category"
      emptyText="Category"
      choices={dealCategories}
      optionText="label"
      optionValue="value"
    />,
  ];

  return (
    <List
      perPage={100}
      filter={{ "archived_at@is": null }}
      title={false}
      sort={{ field: "index", order: "DESC" }}
      filters={dealFilters}
      actions={<DealActions />}
      pagination={null}
    >
      <DealLayout />
    </List>
  );
};

const DealLayout = () => {
  const location = useLocation();
  const matchCreate = matchPath("/deals/create", location.pathname);
  const matchEdit = matchPath("/deals/:id", location.pathname);
  const { view } = useDealsViewPreference();

  const { data, isPending, filterValues } = useListContext();
  const config = useConfigurationContext();
  const selectedPipelineId =
    (filterValues?.pipeline_id as string | undefined) ||
    getDefaultPipeline(config)?.id ||
    "default";
  const hasFilters = filterValues && Object.keys(filterValues).length > 0;

  if (isPending) return null;
  if (!data?.length && !hasFilters && view === "board")
    return (
      <>
        <DealEmpty>
          <DealArchivedList />
        </DealEmpty>
      </>
    );

  return (
    <div className="w-full">
      {view === "board" ? (
        <DealListContent pipelineId={selectedPipelineId} />
      ) : (
        <DealTableView />
      )}
      <DealArchivedList />
      <DealCreate open={!!matchCreate} />
      <DealEdit open={!!matchEdit && !matchCreate} id={matchEdit?.params.id} />
    </div>
  );
};

const DealActions = () => {
  const config = useConfigurationContext();
  const [manageOpen, setManageOpen] = useState(false);
  const { view, setView } = useDealsViewPreference();
  const { filterValues, displayedFilters, setFilters } = useListFilterContext();
  const selectedPipelineId =
    (filterValues.pipeline_id as string | undefined) ||
    getDefaultPipeline(config)?.id ||
    "default";

  useEffect(() => {
    if (!filterValues.pipeline_id && selectedPipelineId) {
      setFilters(
        { ...filterValues, pipeline_id: selectedPipelineId },
        displayedFilters,
      );
    }
  }, [displayedFilters, filterValues, selectedPipelineId, setFilters]);

  return (
    <div className="w-full">
      <div className="flex w-full items-center justify-between gap-3 overflow-x-auto">
        <div className="flex min-w-max flex-1 items-center gap-2">
          <ProjectSearchField />
          <PipelineSelect />
          <OnlyMineSwitch />
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setManageOpen(true)}
          >
            Manage Stages
          </Button>
        </div>
        <div className="flex min-w-max items-center gap-2">
          <span className="hidden text-sm text-muted-foreground xl:inline">View</span>
          <ToggleGroup
            type="single"
            value={view}
            onValueChange={(nextView) => {
              if (nextView === "board" || nextView === "list") {
                setView(nextView);
              }
            }}
            variant="outline"
            size="sm"
          >
            <ToggleGroupItem value="board">Board</ToggleGroupItem>
            <ToggleGroupItem value="list">List</ToggleGroupItem>
          </ToggleGroup>
          <div className="xl:hidden">
            <FilterButton size="icon" showLabel={false} />
          </div>
          <div className="hidden xl:block">
            <FilterButton />
          </div>
          <div className="xl:hidden">
            <ExportButton showLabel={false} className="px-2.5" />
          </div>
          <div className="hidden xl:block">
            <ExportButton />
          </div>
          <CreateButton
            label="New Project"
            className="bg-black text-white hover:bg-black/90 border-black"
          />
        </div>
      </div>
      <ManageStagesDialog
        open={manageOpen}
        onOpenChange={setManageOpen}
        pipelineId={selectedPipelineId}
      />
    </div>
  );
};

const ProjectSearchField = () => {
  const { filterValues, displayedFilters, setFilters } = useListFilterContext();
  const [value, setValue] = useState(() => String(filterValues.q ?? ""));

  useEffect(() => {
    setValue(String(filterValues.q ?? ""));
  }, [filterValues.q]);

  useEffect(() => {
    const timeoutId = setTimeout(() => {
      const currentQ = typeof filterValues.q === "string" ? filterValues.q : undefined;
      const nextQ = value.trim() ? value : undefined;
      if (currentQ === nextQ) {
        return;
      }
      const nextFilterValues = { ...filterValues };
      if (nextQ) {
        nextFilterValues.q = nextQ;
      } else {
        delete nextFilterValues.q;
      }
      setFilters(nextFilterValues, displayedFilters);
    }, 250);
    return () => clearTimeout(timeoutId);
  }, [displayedFilters, filterValues, setFilters, value]);

  return (
    <div className="relative min-w-[220px] max-w-[460px] flex-1">
      <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
      <Input
        value={value}
        onChange={(event) => setValue(event.target.value)}
        placeholder="Search"
        className="pl-8"
      />
    </div>
  );
};

const OnlyMineSwitch = () => {
  const { filterValues, displayedFilters, setFilters } = useListFilterContext();
  const { identity } = useGetIdentity();

  const isActive = typeof filterValues.sales_id !== "undefined";
  const handleChange = () => {
    const nextFilterValues = { ...filterValues };
    if (isActive) {
      delete nextFilterValues.sales_id;
    } else {
      nextFilterValues.sales_id = identity?.id;
    }
    setFilters(nextFilterValues, displayedFilters);
  };

  return (
    <div className="flex h-9 shrink-0 items-center gap-2 rounded-md border border-input px-3">
      <Switch id="projects-only-mine" checked={isActive} onCheckedChange={handleChange} />
      <Label
        htmlFor="projects-only-mine"
        className="hidden text-sm font-normal xl:inline"
      >
        Only companies I manage
      </Label>
      <SlidersHorizontal className="h-4 w-4 text-muted-foreground" />
    </div>
  );
};

const PipelineSelect = () => {
  const config = useConfigurationContext();
  const { filterValues, displayedFilters, setFilters } = useListFilterContext();
  const selectedPipelineId =
    (filterValues.pipeline_id as string | undefined) ||
    getDefaultPipeline(config)?.id ||
    "default";

  return (
    <select
      className="h-9 rounded-md border border-input bg-background px-3 text-sm"
      value={selectedPipelineId}
      onChange={(event) =>
        setFilters(
          { ...filterValues, pipeline_id: event.target.value },
          displayedFilters,
        )
      }
    >
      {config.dealPipelines.map((pipeline) => (
        <option key={pipeline.id} value={pipeline.id}>
          {pipeline.label}
        </option>
      ))}
    </select>
  );
};

const ManageStagesDialog = ({
  open,
  onOpenChange,
  pipelineId,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  pipelineId: string;
}) => {
  const config = useConfigurationContext();
  const setConfig = useConfigurationUpdater();
  const dataProvider = useDataProvider();
  const notify = useNotify();
  const pipeline = getPipelineById(config, pipelineId);
  const [draftStages, setDraftStages] = useState(pipeline?.stages ?? []);
  const { data: deals = [] } = useListContext();

  useEffect(() => {
    setDraftStages(pipeline?.stages ?? []);
  }, [pipeline?.id, pipeline?.stages]);

  if (!pipeline) return null;

  const handleSave = async () => {
    if (!draftStages.length) {
      notify("At least one stage is required", { type: "error" });
      return;
    }

    const nextPipelines = config.dealPipelines.map((item) =>
      item.id === pipeline.id
        ? {
            ...item,
            stages: draftStages.map((stage, index) => ({
              ...stage,
              id: stage.id || stage.label.toLowerCase().replace(/\s+/g, "-"),
              order: index + 1,
              pipelineId: pipeline.id,
            })),
          }
        : item,
    );
    const nextConfig = { ...config, dealPipelines: nextPipelines };
    setConfig(nextConfig);
    await dataProvider.updateConfiguration(nextConfig);
    notify("Pipeline stages updated");
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Manage Stages - {pipeline.label}</DialogTitle>
        </DialogHeader>
        <div className="space-y-2">
          {draftStages.map((stage, index) => (
            <div key={stage.id || index} className="grid grid-cols-[1fr_auto_auto_auto] gap-2">
              <input
                className="h-9 rounded-md border border-input bg-background px-3 text-sm"
                value={stage.label}
                onChange={(event) =>
                  setDraftStages((prev) =>
                    prev.map((item, itemIndex) =>
                      itemIndex === index
                        ? {
                            ...item,
                            label: event.target.value,
                            id:
                              event.target.value
                                .toLowerCase()
                                .replace(/\s+/g, "-") || item.id,
                          }
                        : item,
                    ),
                  )
                }
              />
              <input
                type="color"
                value={stage.color || "#64748b"}
                onChange={(event) =>
                  setDraftStages((prev) =>
                    prev.map((item, itemIndex) =>
                      itemIndex === index ? { ...item, color: event.target.value } : item,
                    ),
                  )
                }
                className="h-9 w-10 rounded-md border border-input bg-background p-1"
              />
              <div className="flex gap-1">
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={index === 0}
                  onClick={() =>
                    setDraftStages((prev) => {
                      const next = [...prev];
                      [next[index - 1], next[index]] = [next[index], next[index - 1]];
                      return next;
                    })
                  }
                >
                  ↑
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={index === draftStages.length - 1}
                  onClick={() =>
                    setDraftStages((prev) => {
                      const next = [...prev];
                      [next[index + 1], next[index]] = [next[index], next[index + 1]];
                      return next;
                    })
                  }
                >
                  ↓
                </Button>
              </div>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => {
                  const inUse = deals.some(
                    (deal) =>
                      (deal.pipeline_id || pipeline.id) === pipeline.id &&
                      deal.stage === stage.id,
                  );
                  if (inUse) {
                    notify("This stage is in use by projects", { type: "error" });
                    return;
                  }
                  setDraftStages((prev) => prev.filter((_, itemIndex) => itemIndex !== index));
                }}
              >
                Delete
              </Button>
            </div>
          ))}
          <Button
            type="button"
            variant="outline"
            onClick={() =>
              setDraftStages((prev) => [
                ...prev,
                {
                  id: `stage-${Date.now()}`,
                  label: "New Stage",
                  color: "#64748b",
                  order: prev.length + 1,
                  pipelineId: pipeline.id,
                },
              ])
            }
          >
            Add Stage
          </Button>
        </div>
        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button type="button" onClick={handleSave}>
            Save
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default DealList;
