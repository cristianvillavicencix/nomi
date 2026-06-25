import { useEffect } from "react";
import {
  useGetIdentity,
  useListContext,
  useListFilterContext,
} from "ra-core";
import { matchPath, useLocation } from "react-router";
import { AutocompleteInput } from "@/components/admin/autocomplete-input";
import { List } from "@/components/admin/list";
import { ReferenceInput } from "@/components/admin/reference-input";
import { FilterButton } from "@/components/admin/filter-form";
import { SelectInput } from "@/components/admin/select-input";
import {
  PageActions,
  PageTitle,
} from "@/components/atomic-crm/layout/PageActions";
import { ModuleInfoPopover } from "@/components/atomic-crm/layout/ModuleInfoPopover";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";

import { useConfigurationContext } from "../root/ConfigurationContext";
import { canUseCrmPermission } from "../providers/commons/crmPermissions";
import { DealArchivedList } from "./DealArchivedList";
import { DealEdit } from "./DealEdit";
import { DealTableView } from "./DealTableView";
import { DealShow } from "./DealShow";
import { ProjectCreateFlow } from "@/modules/deals/ProjectCreateFlow";
import { NewDealCreateButton } from "@/modules/deals/NewDealCreateButton";
import { LbsDealBoardContent } from "@/modules/deals/LbsDealBoardContent";
import { getDefaultPipeline } from "./pipelines";
import { useDealsViewPreference } from "./useDealsViewPreference";

const DealList = () => {
  const location = useLocation();
  const matchShow = matchPath("/deals/:id/show", location.pathname);
  const { identity } = useGetIdentity();
  const { dealCategories } = useConfigurationContext();
  const { view } = useDealsViewPreference();

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
      disableBreadcrumb
      sort={{ field: "index", order: "DESC" }}
      filters={dealFilters}
      actions={<DealActions />}
      pagination={null}
      contentScrollable={view !== "board"}
      className={view === "board" ? "mt-0 min-h-0 flex-1" : undefined}
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
  const { filterValues } = useListContext();
  const { filterValues: listFilterValues, displayedFilters, setFilters } =
    useListFilterContext();
  const config = useConfigurationContext();
  const selectedPipelineId =
    (filterValues?.pipeline_id as string | undefined) ||
    getDefaultPipeline(config)?.id ||
    "default";

  useEffect(() => {
    if (!listFilterValues.pipeline_id && selectedPipelineId) {
      setFilters(
        { ...listFilterValues, pipeline_id: selectedPipelineId },
        displayedFilters,
      );
    }
  }, [displayedFilters, listFilterValues, selectedPipelineId, setFilters]);

  if (view === "board") {
    return (
      <div className="flex h-full min-h-0 w-full flex-col">
        <LbsDealBoardContent pipelineId={selectedPipelineId} />
        <DealArchivedList />
        <ProjectCreateFlow />
        <DealEdit
          open={!!matchEdit && !matchCreate}
          id={matchEdit?.params.id}
        />
      </div>
    );
  }

  return (
    <div className="w-full">
      <DealTableView />
      <DealArchivedList />
      <ProjectCreateFlow />
      <DealEdit open={!!matchEdit && !matchCreate} id={matchEdit?.params.id} />
    </div>
  );
};

const DealActions = () => {
  const { data: identity } = useGetIdentity();
  const { view, setView } = useDealsViewPreference();
  const canManageSales = canUseCrmPermission(identity as any, "sales.manage");

  return (
    <PageActions>
      <PageTitle label="Deals" />
      <div className="ml-auto flex items-center gap-2">
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
        <FilterButton size="icon" showLabel={false} />
        {canManageSales ? <NewDealCreateButton /> : null}
        <ModuleInfoPopover
          title="Deals"
          description="Pipeline control for every deal, from setup to delivered."
        />
      </div>
    </PageActions>
  );
};

export default DealList;
