import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbPage,
} from "@/components/admin/breadcrumb";
import type { ListBaseProps, ListControllerResult, RaRecord } from "ra-core";
import {
  FilterContext,
  ListBase,
  Translate,
  useGetResourceLabel,
  useHasDashboard,
  useResourceContext,
  useResourceDefinition,
  useTranslate,
} from "ra-core";
import type { ReactElement, ReactNode } from "react";
import { Link } from "react-router";
import { cn } from "@/lib/utils";
import { CreateButton } from "@/components/admin/create-button";
import { ExportButton } from "@/components/admin/export-button";
import { ListPagination } from "@/components/admin/list-pagination";
import { FilterButton, FilterForm } from "@/components/admin/filter-form";
import {
  PageLayout,
  ScrollableContentArea,
  StickyPageHeader,
} from "@/components/atomic-crm/layout/page-shell";

/**
 * A complete list page with breadcrumb, title, filters, and pagination.
 *
 * It fetches a list of records from the data provider (via ra-core hooks),
 * puts them in a ListContext, renders a default layout (breadcrumb, title,
 * action buttons, inline filters, pagination), then renders its children
 * (usually a <DataTable>).
 *
 * @see {@link https://marmelab.com/shadcn-admin-kit/docs/list/ List documentation}
 *
 * @example
 * import { DataTable, List } from "@/components/admin";
 *
 * export const UserList = () => (
 *   <List>
 *     <DataTable>
 *       <DataTable.Col source="id" />
 *       <DataTable.Col source="name" />
 *       <DataTable.Col source="username" />
 *       <DataTable.Col source="email" />
 *       <DataTable.Col source="address.street" />
 *       <DataTable.Col source="phone" />
 *       <DataTable.Col source="website" />
 *       <DataTable.Col source="company.name" />
 *     </DataTable>
 *   </List>
 * );
 */
export const List = <RecordType extends RaRecord = RaRecord>(
  props: ListProps<RecordType>,
) => {
  const {
    debounce,
    disableAuthentication,
    disableSyncWithLocation,
    exporter,
    filter,
    filterDefaultValues,
    loading,
    perPage,
    queryOptions,
    resource,
    sort,
    storeKey,
    ...rest
  } = props;

  return (
    <ListBase<RecordType>
      debounce={debounce}
      disableAuthentication={disableAuthentication}
      disableSyncWithLocation={disableSyncWithLocation}
      exporter={exporter}
      filter={filter}
      filterDefaultValues={filterDefaultValues}
      loading={loading}
      perPage={perPage}
      queryOptions={queryOptions}
      resource={resource}
      sort={sort}
      storeKey={storeKey}
    >
      <ListView<RecordType> {...rest} />
    </ListBase>
  );
};

export interface ListProps<RecordType extends RaRecord = RaRecord>
  extends ListBaseProps<RecordType>,
    ListViewProps<RecordType> {}

/**
 * The view component for List pages with layout and UI.
 *
 * @internal
 */
export const ListView = <RecordType extends RaRecord = RaRecord>(
  props: ListViewProps<RecordType>,
) => {
  const {
    disableBreadcrumb,
    filters,
    pagination = defaultPagination,
    title,
    children,
    actions,
    contentScrollable = true,
  } = props;
  const translate = useTranslate();
  const resource = useResourceContext();
  if (!resource) {
    throw new Error(
      "The ListView component must be used within a ResourceContextProvider",
    );
  }
  const getResourceLabel = useGetResourceLabel();
  const resourceLabel = getResourceLabel(resource, 2);
  const finalTitle =
    title !== undefined
      ? title
      : translate("ra.page.list", {
          name: resourceLabel,
        });
  const { hasCreate } = useResourceDefinition({ resource });
  const hasDashboard = useHasDashboard();

  return (
    <PageLayout>
      <FilterContext.Provider value={filters}>
        <StickyPageHeader className="pb-2">
          {!disableBreadcrumb && (
            <Breadcrumb>
              {hasDashboard && (
                <BreadcrumbItem>
                  <Link to="/">
                    <Translate i18nKey="ra.page.dashboard">Home</Translate>
                  </Link>
                </BreadcrumbItem>
              )}
              <BreadcrumbPage>{resourceLabel}</BreadcrumbPage>
            </Breadcrumb>
          )}
          <div className="my-2 flex min-w-0 w-full flex-wrap items-start justify-between gap-2">
            {finalTitle !== false ? (
              <h2 className="text-2xl font-bold tracking-tight mb-2">
                {finalTitle}
              </h2>
            ) : null}
            {actions ?? (
              <div className="flex items-center gap-2">
                {filters && filters.length > 0 ? <FilterButton /> : null}
                {hasCreate ? <CreateButton /> : null}
                {<ExportButton />}
              </div>
            )}
          </div>
          <FilterForm />
        </StickyPageHeader>

        {contentScrollable ? (
          <ScrollableContentArea className={cn("my-2", props.className)}>
            {children}
            {pagination}
          </ScrollableContentArea>
        ) : (
          <div className={cn("my-2 min-h-0 flex-1 overflow-hidden", props.className)}>
            {children}
            {pagination}
          </div>
        )}
      </FilterContext.Provider>
    </PageLayout>
  );
};

const defaultPagination = <ListPagination />;

export const Empty = () => {
  const translate = useTranslate();
  const resource = useResourceContext();
  const getResourceLabel = useGetResourceLabel();
  const { hasCreate } = useResourceDefinition({ resource });
  if (!resource) {
    return null;
  }
  const resourceLabel = getResourceLabel(resource, 2);

  return (
    <div className="flex min-h-[50vh] flex-col items-center justify-center gap-2 text-center">
      <h2 className="text-2xl font-semibold">
        {translate("ra.page.empty", { name: resourceLabel })}
      </h2>
      {hasCreate ? (
        <>
          <p className="text-muted-foreground">{translate("ra.page.invite")}</p>
          <CreateButton />
        </>
      ) : null}
    </div>
  );
};

export interface ListViewProps<RecordType extends RaRecord = RaRecord> {
  children?: ReactNode;
  disableBreadcrumb?: boolean;
  render?: (props: ListControllerResult<RecordType, Error>) => ReactNode;
  actions?: ReactElement | false;
  filters?: ReactNode[];
  pagination?: ReactNode;
  title?: ReactNode | string | false;
  className?: string;
  contentScrollable?: boolean;
}
