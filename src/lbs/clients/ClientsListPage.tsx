import { useEffect, useState } from "react";
import { useGetIdentity, useListContext, useListFilterContext } from "ra-core";
import { Plus } from "lucide-react";
import { Link } from "react-router";
import { buttonVariants } from "@/components/ui/button";
import { DataTable } from "@/components/admin/data-table";
import { List } from "@/components/admin/list";
import { ListPagination } from "@/components/admin/list-pagination";
import { SortButton } from "@/components/admin/sort-button";
import { TopToolbar } from "@/components/atomic-crm/layout/TopToolbar";
import { ModuleInfoPopover } from "@/components/atomic-crm/layout/ModuleInfoPopover";
import { SpotlightSearchButton } from "@/components/atomic-crm/layout/SpotlightSearchButton";
import { CompanyEmpty } from "@/components/atomic-crm/companies/CompanyEmpty";
import { CompanyAvatar } from "@/components/atomic-crm/companies/CompanyAvatar";
import type { Company } from "@/components/atomic-crm/types";
import {
  collectBusinessSocialLinks,
  collectClientEmails,
  getPrimaryContactFullName,
  getPrimaryContactPhone,
  type CompanyWithPrimaryContact,
} from "@/lbs/clients/clientProfile";
import { ClientSocialLinksDisplay } from "@/lbs/clients/ClientSocialLinksDisplay";
import { cn } from "@/lib/utils";
import { getClientCreatePath, getClientShowPath } from "@/lbs/routing";

export const ClientsListPage = () => {
  const { identity } = useGetIdentity();
  if (!identity) return null;

  return (
    <List
      resource="companies"
      title="Clients"
      disableBreadcrumb
      perPage={25}
      sort={{ field: "name", order: "ASC" }}
      actions={<ClientsListActions />}
      pagination={<ListPagination rowsPerPageOptions={[10, 25, 50, 100]} />}
    >
      <ClientsListLayout />
    </List>
  );
};

const ClientsListActions = () => {
  const { filterValues, displayedFilters, setFilters } = useListFilterContext();
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
    <TopToolbar className="w-full flex-wrap items-center justify-end gap-3">
      <SpotlightSearchButton
        title="Search Clients"
        description="Find clients by business name, contact name, email, or phone."
        placeholder="Search clients..."
        value={query}
        onValueChange={setQuery}
      />
      <SortButton fields={["name", "website"]} />
      <Link
        to={getClientCreatePath()}
        className={cn(buttonVariants({ variant: "outline" }))}
      >
        <Plus />
        New client
      </Link>
      <ModuleInfoPopover
        title="Clients"
        description="Business profiles with linked contacts, projects, contracts, and support."
      />
    </TopToolbar>
  );
};

const ClientsListLayout = () => {
  const { data, isPending, filterValues } = useListContext<CompanyWithPrimaryContact>();
  const hasFilters = filterValues && Object.keys(filterValues).length > 0;

  if (isPending) return null;
  if (!data?.length && !hasFilters) return <CompanyEmpty />;

  return (
    <DataTable
      rowClick={(_id, _resource, record) => getClientShowPath(record.id)}
      rowClassName={() => "[&_td]:py-2.5"}
    >
      <DataTable.Col
        label=""
        disableSort
        className="w-[52px]"
        render={(record: Company) => <CompanyAvatar record={record} width={25} />}
      />
      <DataTable.Col
        source="name"
        label="Business name"
        render={(record: CompanyWithPrimaryContact) => (
          <span className="font-medium">{record.name?.trim() || "—"}</span>
        )}
      />
      <DataTable.Col
        source="primary_contact_last_name"
        label="Client"
        render={(record: CompanyWithPrimaryContact) =>
          getPrimaryContactFullName(record)
        }
      />
      <DataTable.Col
        source="primary_contact_phone_jsonb"
        label="Phone"
        render={(record: CompanyWithPrimaryContact) =>
          getPrimaryContactPhone(record)
        }
      />
      <DataTable.Col
        source="primary_contact_email_jsonb"
        label="Email"
        render={(record: CompanyWithPrimaryContact) =>
          collectClientEmails(record)[0]?.email ?? "—"
        }
      />
      <DataTable.Col
        source="website"
        label="Website"
        render={(record: CompanyWithPrimaryContact) => record.website?.trim() || "—"}
      />
      <DataTable.Col
        source="linkedin_url"
        label="Social media"
        disableSort
        render={(record: CompanyWithPrimaryContact) => {
          const links = collectBusinessSocialLinks(record);
          if (links.length === 0) return "—";

          return (
            <ClientSocialLinksDisplay links={links} stopPropagation iconClassName="size-4" />
          );
        }}
      />
    </DataTable>
  );
};
