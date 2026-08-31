import { useMemo, useState } from "react";
import { useGetIdentity, useListContext } from "ra-core";
import { useNavigate, useSearchParams } from "react-router";
import { DataTable } from "@/components/admin/data-table";
import { List } from "@/components/admin/list";
import { ListPagination } from "@/components/admin/list-pagination";
import { ReferenceField } from "@/components/admin/reference-field";
import { SortButton } from "@/components/admin/sort-button";
import {
  PageActions,
  PageTitle,
} from "@/components/atomic-crm/layout/PageActions";
import {
  ModuleSearchField,
  ModuleToolbar,
  ModuleToolbarActions,
} from "@/components/atomic-crm/layout/ModuleToolbar";
import type { Contract } from "@/modules/types";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { getClientShowPath } from "@/app/routing";
import { ContractTermsSettings } from "@/modules/settings/ContractTermsSettings";
import { cn } from "@/lib/utils";

const formatDate = (value?: string | null) => {
  if (!value) return "—";
  const date = new Date(`${value}T12:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
};

type ContractsTab = "signed" | "templates";

const resolveContractsTab = (raw: string | null): ContractsTab =>
  raw === "templates" ? "templates" : "signed";

export const ContractsList = () => {
  const { identity } = useGetIdentity();
  const [searchParams, setSearchParams] = useSearchParams();
  const tab = resolveContractsTab(searchParams.get("tab"));

  if (!identity) return null;

  const setTab = (next: string) => {
    const value = resolveContractsTab(next);
    const params = new URLSearchParams(searchParams);
    if (value === "signed") params.delete("tab");
    else params.set("tab", value);
    setSearchParams(params, { replace: true });
  };

  return (
    <div className="space-y-4">
      <PageActions>
        <PageTitle label="Contracts" />
      </PageActions>

      <Tabs value={tab} onValueChange={setTab} className="gap-4">
        <TabsList className="h-9 w-fit">
          <TabsTrigger value="signed">Signed</TabsTrigger>
          <TabsTrigger value="templates">Templates</TabsTrigger>
        </TabsList>

        <TabsContent value="signed" className="mt-0 outline-none">
          <List
            resource="contracts"
            title={false}
            disableBreadcrumb
            perPage={25}
            sort={{ field: "updated_at", order: "DESC" }}
            actions={false}
            pagination={<ListPagination rowsPerPageOptions={[10, 25, 50]} />}
          >
            <ContractsSignedListLayout />
          </List>
        </TabsContent>

        <TabsContent value="templates" className="mt-0 outline-none">
          <ContractTermsSettings />
        </TabsContent>
      </Tabs>
    </div>
  );
};

const ContractsSignedListLayout = () => {
  const { data, isPending, filterValues } = useListContext<Contract>();
  const navigate = useNavigate();
  const hasFilters = filterValues && Object.keys(filterValues).length > 0;
  const [searchQuery, setSearchQuery] = useState("");

  const filteredData = useMemo(() => {
    const trimmed = searchQuery.trim().toLowerCase();
    if (!trimmed) return data;
    return (data ?? []).filter((contract) =>
      [contract.title, contract.status]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(trimmed),
    );
  }, [data, searchQuery]);

  const toolbar = (
    <ModuleToolbar className="shrink-0">
      <ModuleSearchField
        value={searchQuery}
        onChange={setSearchQuery}
        basePlaceholder="Search contracts by title"
        total={data?.length}
        itemSingular="contract"
      />
      <ModuleToolbarActions>
        <SortButton fields={["title", "status", "expires_at", "updated_at"]} />
      </ModuleToolbarActions>
    </ModuleToolbar>
  );

  if (isPending) return toolbar;

  if (!data?.length && !hasFilters) {
    return (
      <div className="space-y-3">
        {toolbar}
        <p className="py-8 text-center text-sm text-muted-foreground">
          No signed contracts yet. Templates for new agreements are under the
          Templates tab.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {toolbar}
      {!filteredData?.length ? (
        <p className="py-8 text-center text-sm text-muted-foreground">
          No contracts match your search.
        </p>
      ) : (
        <DataTable
          data={filteredData}
          rowClick={(id) => navigate(`/contracts/${id}/show`)}
          rowClassName={() => "[&_td]:py-1.5"}
        >
          <DataTable.Col source="title" label="Title" />
          <DataTable.Col
            source="status"
            label="Status"
            render={(record: Contract) => (
              <Badge variant="outline" className={cn("capitalize")}>
                {record.status?.replace(/-/g, " ") ?? "draft"}
              </Badge>
            )}
          />
          <DataTable.Col
            source="company_id"
            label="Client"
            render={(record: Contract) =>
              record.company_id ? (
                <ReferenceField
                  source="company_id"
                  reference="companies"
                  record={record}
                  link={(id) => getClientShowPath(id)}
                />
              ) : (
                "—"
              )
            }
          />
          <DataTable.Col
            source="expires_at"
            label="Expires"
            render={(record: Contract) => formatDate(record.expires_at)}
          />
          <DataTable.Col
            source="signed_at"
            label="Signed"
            render={(record: Contract) =>
              record.signed_at
                ? new Date(record.signed_at).toLocaleDateString()
                : "—"
            }
          />
        </DataTable>
      )}
    </div>
  );
};
