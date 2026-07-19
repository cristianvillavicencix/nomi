import { useEffect, useMemo, useState } from "react";
import { useGetIdentity, useListContext, useListFilterContext } from "ra-core";
import { CreateButton } from "@/components/admin/create-button";
import { DataTable } from "@/components/admin/data-table";
import { ExportButton } from "@/components/admin/export-button";
import { List } from "@/components/admin/list";
import { ListPagination } from "@/components/admin/list-pagination";
import { SortButton } from "@/components/admin/sort-button";
import { canUseCrmPermission } from "../providers/commons/crmPermissions";
import { CrmPhoneLink } from "@/modules/voice/CrmPhoneLink";

import { PageActions, PageTitle } from "../layout/PageActions";
import {
  ModuleSearchField,
  ModuleToolbar,
  ModuleToolbarActions,
} from "../layout/ModuleToolbar";
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
      actions={
        <PageActions>
          <PageTitle label="Companies" />
        </PageActions>
      }
      pagination={<ListPagination rowsPerPageOptions={[10, 25, 50, 100]} />}
    >
      <CompanyListToolbar />
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
    <DataTable rowClick="show" rowClassName={() => "[&_td]:py-1.5"}>
      <DataTable.Col
        label=""
        disableSort
        className="w-[52px]"
        cellClassName="w-[52px]"
        render={(record: any) => <CompanyAvatar record={record} width={25} />}
      />
      <DataTable.Col
        source="name"
        label="Company Name"
        className="w-[22%]"
        cellClassName="w-[22%]"
      />
      <DataTable.Col
        source="sector"
        label="Sector"
        className="w-[16%]"
        cellClassName="w-[16%] text-xs text-muted-foreground"
        render={(record: any) =>
          record?.sector
            ? (sectorLabelByValue[String(record.sector)] ?? record.sector)
            : "—"
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
        render={(record: any) => (
          <CrmPhoneLink
            phone={String(record?.phone_number ?? "")}
            className="link-action"
          />
        )}
      />
    </DataTable>
  );
};

const CompanyListToolbar = () => {
  const { identity } = useGetIdentity();
  const canManageSales = canUseCrmPermission(identity as any, "sales.manage");
  const { total, filterValues } = useListContext();
  const { setFilters } = useListFilterContext();
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
    <ModuleToolbar className="mb-3 shrink-0">
      <ModuleSearchField
        value={searchDraft}
        onChange={setSearchDraft}
        basePlaceholder="Search companies by name, email, or website"
        total={total}
        itemSingular="company"
        itemPlural="companies"
      />
      <ModuleToolbarActions>
        <SortButton fields={["name", "created_at", "nb_contacts"]} />
        <ExportButton />
        {canManageSales ? <CreateButton label="New Company" /> : null}
      </ModuleToolbarActions>
    </ModuleToolbar>
  );
};
