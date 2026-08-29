import { useEffect, useState } from "react";
import { useGetIdentity, useListContext, useListFilterContext } from "ra-core";
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
import {
  ModuleSearchField,
  ModuleToolbar,
  ModuleToolbarActions,
} from "@/components/atomic-crm/layout/ModuleToolbar";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { KanbanSquare, List as ListIcon } from "lucide-react";
import { useIsMobile } from "@/hooks/use-mobile";

import { useConfigurationContext } from "../root/ConfigurationContext";
import { canUseCrmPermission } from "../providers/commons/crmPermissions";
import { DealArchivedList } from "./DealArchivedList";
import { DealEdit } from "./DealEdit";
import { DealTableView } from "./DealTableView";
import { DealShow } from "./DealShow";
import { MobileDealListLayout } from "./MobileDealList";
import { ProjectCreateFlow } from "@/modules/deals/ProjectCreateFlow";
import { NewDealCreateButton } from "@/modules/deals/NewDealCreateButton";
import { LbsDealBoardContent } from "@/modules/deals/LbsDealBoardContent";
import { getDefaultPipeline } from "./pipelines";
import { useDealsViewPreference } from "./useDealsViewPreference";

const DealList = () => {
  const location = useLocation();
  const isMobile = useIsMobile();
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
      <AutocompleteInput label={false} placeholder="Account" />
    </ReferenceInput>,
    <SelectInput
      source="category"
      emptyText="Category"
      choices={dealCategories}
      optionText="label"
      optionValue="value"
    />,
  ];

  if (isMobile) {
    return (
      <List
        perPage={50}
        filter={{ "archived_at@is": null }}
        title={false}
        disableBreadcrumb
        sort={{ field: "updated_at", order: "DESC" }}
        filters={dealFilters}
        actions={false}
        pagination={null}
        contentScrollable={false}
        className="min-h-0 flex-1"
      >
        <MobileDealListLayout />
        <ProjectCreateFlow />
      </List>
    );
  }

  return (
    <List
      perPage={100}
      filter={{ "archived_at@is": null }}
      title={false}
      disableBreadcrumb
      sort={{ field: "index", order: "DESC" }}
      filters={dealFilters}
      actions={
        <PageActions>
          <PageTitle label="Deals" />
        </PageActions>
      }
      pagination={null}
      contentScrollable={view !== "board"}
      className={view === "board" ? "mt-0 min-h-0 flex-1" : undefined}
    >
      <DealLayout />
    </List>
  );
};

const DealListSearchField = () => {
  const { total } = useListContext();
  const { filterValues, setFilters } = useListFilterContext();
  const [searchDraft, setSearchDraft] = useState(
    () => String(filterValues?.q ?? ""),
  );

  useEffect(() => {
    setSearchDraft(String(filterValues?.q ?? ""));
  }, [filterValues?.q]);

  useEffect(() => {
    const handle = window.setTimeout(() => {
      const next = searchDraft.trim();
      const current = String(filterValues?.q ?? "").trim();
      if (next === current) return;
      const nextFilters = { ...filterValues };
      if (next) nextFilters.q = next;
      else delete nextFilters.q;
      setFilters(nextFilters, undefined, false);
    }, 250);
    return () => window.clearTimeout(handle);
  }, [searchDraft, filterValues, setFilters]);

  return (
    <ModuleSearchField
      value={searchDraft}
      onChange={setSearchDraft}
      basePlaceholder="Search deals by name or company"
      total={total}
      itemSingular="deal"
    />
  );
};

const DealListToolbar = () => {
  const { data: identity } = useGetIdentity();
  const { view, setView } = useDealsViewPreference();
  const canManageSales = canUseCrmPermission(identity as any, "sales.manage");

  return (
    <ModuleToolbar className="shrink-0">
      <DealListSearchField />
      <ModuleToolbarActions>
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
          className="w-fit shrink-0"
        >
          <ToggleGroupItem value="list" aria-label="List view">
            <ListIcon className="size-4" />
            List
          </ToggleGroupItem>
          <ToggleGroupItem value="board" aria-label="Board view">
            <KanbanSquare className="size-4" />
            Board
          </ToggleGroupItem>
        </ToggleGroup>
        <FilterButton size="icon" showLabel={false} />
        {canManageSales ? <NewDealCreateButton /> : null}
      </ModuleToolbarActions>
    </ModuleToolbar>
  );
};

const DealLayout = () => {
  const location = useLocation();
  const matchCreate = matchPath("/deals/create", location.pathname);
  const matchEdit = matchPath("/deals/:id", location.pathname);
  const { view } = useDealsViewPreference();
  const { filterValues } = useListContext();
  const {
    filterValues: listFilterValues,
    displayedFilters,
    setFilters,
  } = useListFilterContext();
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
      <div className="flex h-full min-h-0 w-full flex-col gap-3">
        <DealListToolbar />
        <div className="min-h-0 flex-1">
          <LbsDealBoardContent pipelineId={selectedPipelineId} />
        </div>
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
    <div className="w-full space-y-3">
      <DealListToolbar />
      <DealTableView />
      <DealArchivedList />
      <ProjectCreateFlow />
      <DealEdit open={!!matchEdit && !matchCreate} id={matchEdit?.params.id} />
    </div>
  );
};

export default DealList;
