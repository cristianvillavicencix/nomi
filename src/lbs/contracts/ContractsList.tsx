import { useGetIdentity, useListContext } from "ra-core";
import { useNavigate } from "react-router";
import { DataTable } from "@/components/admin/data-table";
import { List } from "@/components/admin/list";
import { ListPagination } from "@/components/admin/list-pagination";
import { ReferenceField } from "@/components/admin/reference-field";
import { SortButton } from "@/components/admin/sort-button";
import { TopToolbar } from "@/components/atomic-crm/layout/TopToolbar";
import { ModuleInfoPopover } from "@/components/atomic-crm/layout/ModuleInfoPopover";
import { LBS_PLACEHOLDER_MODULES } from "@/lbs/navigation";
import type { Contract } from "@/lbs/types";
import { Badge } from "@/components/ui/badge";

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

export const ContractsList = () => {
  const { identity } = useGetIdentity();
  if (!identity) return null;

  return (
    <List
      resource="contracts"
      title="Contracts"
      disableBreadcrumb
      perPage={25}
      sort={{ field: "updated_at", order: "DESC" }}
      actions={<ContractsListActions />}
      pagination={<ListPagination rowsPerPageOptions={[10, 25, 50]} />}
    >
      <ContractsListLayout />
    </List>
  );
};

const ContractsListActions = () => (
  <TopToolbar className="w-full flex-wrap items-center justify-end gap-3">
    <SortButton fields={["title", "status", "expires_at", "updated_at"]} />
    <ModuleInfoPopover
      title={LBS_PLACEHOLDER_MODULES.contracts.title}
      description={LBS_PLACEHOLDER_MODULES.contracts.description}
    />
  </TopToolbar>
);

const ContractsListLayout = () => {
  const { data, isPending, filterValues } = useListContext<Contract>();
  const navigate = useNavigate();
  const hasFilters = filterValues && Object.keys(filterValues).length > 0;

  if (isPending) return null;

  if (!data?.length && !hasFilters) {
    return (
      <p className="py-8 text-center text-sm text-muted-foreground">
        No contracts yet.
      </p>
    );
  }

  return (
    <DataTable
      rowClick={(id) => navigate(`/contracts/${id}/show`)}
      rowClassName={() => "[&_td]:py-2.5"}
    >
      <DataTable.Col source="title" label="Title" />
      <DataTable.Col
        source="status"
        label="Status"
        render={(record: Contract) => (
          <Badge variant="outline" className="capitalize">
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
              link={(id) => `/clients/${id}/show`}
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
  );
};
