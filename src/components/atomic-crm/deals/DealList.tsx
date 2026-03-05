import { useGetIdentity, useListContext } from "ra-core";
import { matchPath, useLocation } from "react-router";
import { AutocompleteInput } from "@/components/admin/autocomplete-input";
import { CreateButton } from "@/components/admin/create-button";
import { ExportButton } from "@/components/admin/export-button";
import { List } from "@/components/admin/list";
import { ReferenceInput } from "@/components/admin/reference-input";
import { FilterButton } from "@/components/admin/filter-form";
import { SearchInput } from "@/components/admin/search-input";
import { SelectInput } from "@/components/admin/select-input";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";

import { useConfigurationContext } from "../root/ConfigurationContext";
import { TopToolbar } from "../layout/TopToolbar";
import { DealArchivedList } from "./DealArchivedList";
import { DealCreate } from "./DealCreate";
import { DealEdit } from "./DealEdit";
import { DealEmpty } from "./DealEmpty";
import { DealListContent } from "./DealListContent";
import { DealTableView } from "./DealTableView";
import { DealShow } from "./DealShow";
import { OnlyMineInput } from "./OnlyMineInput";
import { useDealsViewPreference } from "./useDealsViewPreference";

const DealList = () => {
  const { identity } = useGetIdentity();
  const { dealCategories } = useConfigurationContext();

  if (!identity) return null;

  const dealFilters = [
    <SearchInput source="q" alwaysOn />,
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
    <OnlyMineInput source="sales_id" alwaysOn />,
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
  const matchShow = matchPath("/deals/:id/show", location.pathname);
  const matchEdit = matchPath("/deals/:id", location.pathname);
  const { view } = useDealsViewPreference();

  const { data, isPending, filterValues } = useListContext();
  const hasFilters = filterValues && Object.keys(filterValues).length > 0;

  if (isPending) return null;
  if (!data?.length && !hasFilters && view === "board")
    return (
      <>
        <DealEmpty>
          <DealShow open={!!matchShow} id={matchShow?.params.id} />
          <DealArchivedList />
        </DealEmpty>
      </>
    );

  return (
    <div className="w-full">
      {view === "board" ? <DealListContent /> : <DealTableView />}
      <DealArchivedList />
      <DealCreate open={!!matchCreate} />
      <DealEdit open={!!matchEdit && !matchCreate} id={matchEdit?.params.id} />
      <DealShow open={!!matchShow} id={matchShow?.params.id} />
    </div>
  );
};

const DealActions = () => {
  const { view, setView } = useDealsViewPreference();

  return (
  <TopToolbar>
    <div className="flex items-center gap-2">
      <span className="text-sm text-muted-foreground">View</span>
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
    </div>
    <FilterButton />
    <ExportButton />
    <CreateButton label="New Project" />
  </TopToolbar>
  );
};

export default DealList;
