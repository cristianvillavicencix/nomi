import { useMemo, useState } from "react";
import { useGetIdentity, useListContext } from "ra-core";
import { useNavigate } from "react-router";
import { CreateButton } from "@/components/admin/create-button";
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
import type { Proposal } from "@/modules/types";
import { Badge } from "@/components/ui/badge";
import { MoneyText } from "@/lib/permissions/MoneyText";
import { getClientShowPath } from "@/app/routing";

const formatDate = (value?: string | null) => {
  const date = new Date(`${value}T12:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
};

export const ProposalsList = () => {
  const { identity } = useGetIdentity();
  if (!identity) return null;

  return (
    <List
      resource="proposals"
      title={false}
      disableBreadcrumb
      perPage={25}
      sort={{ field: "updated_at", order: "DESC" }}
      actions={
        <PageActions>
          <PageTitle label="Proposals" />
        </PageActions>
      }
      pagination={<ListPagination rowsPerPageOptions={[10, 25, 50]} />}
    >
      <ProposalsListLayout />
    </List>
  );
};

const ProposalsListLayout = () => {
  const { data, isPending, filterValues } = useListContext<Proposal>();
  const navigate = useNavigate();
  const hasFilters = filterValues && Object.keys(filterValues).length > 0;
  const [searchQuery, setSearchQuery] = useState("");

  const filteredData = useMemo(() => {
    const trimmed = searchQuery.trim().toLowerCase();
    if (!trimmed) return data;
    return (data ?? []).filter((proposal) =>
      [proposal.title, proposal.proposal_number, proposal.status]
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
        basePlaceholder="Search proposals by title or number"
        total={data?.length}
        itemSingular="proposal"
      />
      <ModuleToolbarActions>
        <SortButton
          fields={["title", "status", "amount", "valid_until", "updated_at"]}
        />
        <CreateButton label="New proposal" />
      </ModuleToolbarActions>
    </ModuleToolbar>
  );

  if (isPending) return toolbar;

  if (!data?.length && !hasFilters) {
    return (
      <div className="space-y-3">
        {toolbar}
        <p className="py-8 text-center text-sm text-muted-foreground">
          No proposals yet. Set up your{" "}
          <a href="/settings?tab=proposals" className="link-action">
            service catalog
          </a>{" "}
          in Settings, then create a proposal with packages and add-ons.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {toolbar}
      {!filteredData?.length ? (
        <p className="py-8 text-center text-sm text-muted-foreground">
          No proposals match your search.
        </p>
      ) : (
        <DataTable
          data={filteredData}
          rowClick={(id) => navigate(`/proposals/${id}/show`)}
          rowClassName={() => "[&_td]:py-1.5"}
        >
          <DataTable.Col
            source="proposal_number"
            label="Number"
            render={(record: Proposal) => record.proposal_number ?? "—"}
          />
          <DataTable.Col source="title" label="Title" />
          <DataTable.Col
            source="status"
            label="Status"
            render={(record: Proposal) => (
              <Badge variant="outline" className="capitalize">
                {record.status?.replace(/-/g, " ") ?? "draft"}
              </Badge>
            )}
          />
          <DataTable.Col
            source="amount"
            label="Amount"
            render={(record: Proposal) => <MoneyText value={record.amount} />}
          />
          <DataTable.Col
            source="company_id"
            label="Client"
            render={(record: Proposal) =>
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
            source="valid_until"
            label="Valid until"
            render={(record: Proposal) => formatDate(record.valid_until)}
          />
        </DataTable>
      )}
    </div>
  );
};
