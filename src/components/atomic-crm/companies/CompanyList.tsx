import { useEffect, useMemo, useState } from "react";
import { useGetIdentity, useListContext, useListFilterContext } from "ra-core";
import { CreateButton } from "@/components/admin/create-button";
import { DataTable } from "@/components/admin/data-table";
import { ExportButton } from "@/components/admin/export-button";
import { List } from "@/components/admin/list";
import { ListPagination } from "@/components/admin/list-pagination";
import { SortButton } from "@/components/admin/sort-button";
import { canUseCrmPermission } from "../providers/commons/crmPermissions";
import { normalizePhoneForTel } from "@/lib/linking";

import { TopToolbar } from "../layout/TopToolbar";
import { ModuleInfoPopover } from "../layout/ModuleInfoPopover";
import { SpotlightSearchButton } from "../layout/SpotlightSearchButton";
import { CompanyEmpty } from "./CompanyEmpty";
import { useConfigurationContext } from "../root/ConfigurationContext";
import { CompanyAvatar } from "./CompanyAvatar";

const normalizeWebsiteHref = (website?: string | null) => {
  const trimmed = String(website ?? "").trim();
  if (!trimmed) return "";
  if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) {
    return trimmed;
  }
  return `https://${trimmed}`;
};

export const CompanyList = () => {
  const { identity } = useGetIdentity();
  if (!identity) return null;
  return (
    <List
      title={false}
      disableBreadcrumb
      perPage={25}
      sort={{ field: "name", order: "ASC" }}
      actions={<CompanyListActions />}
      pagination={<ListPagination rowsPerPageOptions={[10, 25, 50, 100]} />}
    >
      <CompanyListLayout />
    </List>
  );
};

const CompanyListLayout = () => {
  const { data, isPending, filterValues } = useListContext();
  const hasFilters = filterValues && Object.keys(filterValues).length > 0;

  if (isPending) return null;
  if (!data?.length && !hasFilters) return <CompanyEmpty />;

  return <CompaniesRowsList />;
};

const CompaniesRowsList = () => {
  const { companySectors } = useConfigurationContext();
  const sectorLabelByValue = useMemo(
    () =>
      companySectors.reduce<Record<string, string>>((acc, sector) => {
        acc[sector.value] = sector.label;
        return acc;
      }, {}),
    [companySectors],
  );

  return (
    <DataTable rowClick="show" rowClassName={() => "[&_td]:py-2.5"}>
      <DataTable.Col
        label=""
        disableSort
        className="w-[52px]"
        cellClassName="w-[52px]"
        render={(record: any) => <CompanyAvatar record={record} width={25} />}
      />
      <DataTable.Col source="name" label="Company Name" className="w-[22%]" cellClassName="w-[22%]" />
      <DataTable.Col
        source="sector"
        label="Sector"
        className="w-[16%]"
        cellClassName="w-[16%] text-xs text-muted-foreground"
        render={(record: any) =>
          record?.sector ? sectorLabelByValue[String(record.sector)] ?? record.sector : "—"
        }
      />
      <DataTable.Col
        source="nb_contacts"
        label="Contacts"
        className="w-[8%]"
        cellClassName="w-[8%]"
        render={(record: any) => Number(record?.nb_contacts ?? 0)}
      />
      <DataTable.Col
        source="nb_deals"
        label="Projects"
        className="w-[9%]"
        cellClassName="w-[9%]"
        render={(record: any) => Number(record?.nb_deals ?? 0)}
      />
      <DataTable.Col
        source="address"
        label="Address"
        className="w-[23%]"
        cellClassName="w-[23%] text-xs text-muted-foreground"
      />
      <DataTable.Col
        source="website"
        label="Website"
        className="w-[12%]"
        cellClassName="w-[12%] text-xs text-muted-foreground"
        render={(record: any) => {
          const website = String(record?.website ?? "").trim();
          const href = normalizeWebsiteHref(website);
          if (!website || !href) return "—";
          return (
            <a
              href={href}
              target="_blank"
              rel="noreferrer"
              className="link-action"
              onClick={(event) => event.stopPropagation()}
            >
              {website}
            </a>
          );
        }}
      />
      <DataTable.Col
        source="phone_number"
        label="Phone"
        className="w-[10%]"
        cellClassName="w-[10%] text-xs text-muted-foreground"
        render={(record: any) => {
          const { display, telHref } = normalizePhoneForTel(
            String(record?.phone_number ?? ""),
          );
          if (!telHref) return display;
          return (
            <a
              href={telHref}
              className="link-action"
              onClick={(event) => event.stopPropagation()}
            >
              {display}
            </a>
          );
        }}
      />
    </DataTable>
  );
};

const CompanyListActions = () => {
  const { identity } = useGetIdentity();
  const { filterValues, displayedFilters, setFilters } = useListFilterContext();
  const canManageSales = canUseCrmPermission(identity as any, "sales.manage");
  const [query, setQuery] = useState(() =>
    typeof filterValues.q === "string" ? filterValues.q : "",
  );

  useEffect(() => {
    setQuery(typeof filterValues.q === "string" ? filterValues.q : "");
  }, [filterValues.q]);

  useEffect(() => {
    const timeoutId = setTimeout(() => {
      const currentQ = typeof filterValues.q === "string" ? filterValues.q : undefined;
      const nextQ = query.trim() ? query : undefined;
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
  }, [displayedFilters, filterValues, query, setFilters]);

  return (
    <TopToolbar className="w-full flex-wrap items-center justify-end gap-2">
      <div className="flex flex-wrap items-center justify-end gap-2">
        <SpotlightSearchButton
          title="Search Companies"
          description="Find companies instantly by name, location, or account details."
          placeholder="Search companies..."
          value={query}
          onValueChange={setQuery}
        />
        <SortButton fields={["name", "created_at", "nb_contacts"]} />
        <ExportButton />
        {canManageSales ? <CreateButton label="New Company" /> : null}
        <ModuleInfoPopover
          title="Companies"
          description="A single source of truth for every company account."
        />
      </div>
    </TopToolbar>
  );
};
