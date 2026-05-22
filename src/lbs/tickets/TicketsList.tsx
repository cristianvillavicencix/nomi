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
import { CreateTicketButton } from "@/lbs/tickets/CreateTicketButton";
import type { Ticket } from "@/lbs/types";
import { Badge } from "@/components/ui/badge";

export const TicketsList = () => {
  const { identity } = useGetIdentity();
  if (!identity) return null;

  return (
    <List
      resource="tickets"
      title="Tickets"
      disableBreadcrumb
      perPage={25}
      sort={{ field: "updated_at", order: "DESC" }}
      actions={<TicketsListActions />}
      pagination={<ListPagination rowsPerPageOptions={[10, 25, 50]} />}
    >
      <TicketsListLayout />
    </List>
  );
};

const TicketsListActions = () => (
  <TopToolbar className="w-full flex-wrap items-center justify-end gap-3">
    <SortButton fields={["subject", "status", "priority", "updated_at"]} />
    <CreateTicketButton />
    <ModuleInfoPopover
      title={LBS_PLACEHOLDER_MODULES.tickets.title}
      description={LBS_PLACEHOLDER_MODULES.tickets.description}
    />
  </TopToolbar>
);

const TicketsListLayout = () => {
  const { data, isPending, filterValues } = useListContext<Ticket>();
  const navigate = useNavigate();
  const hasFilters = filterValues && Object.keys(filterValues).length > 0;

  if (isPending) return null;

  if (!data?.length && !hasFilters) {
    return (
      <p className="py-8 text-center text-sm text-muted-foreground">
        No support tickets yet.
      </p>
    );
  }

  return (
    <DataTable
      rowClick={(id) => navigate(`/tickets/${id}/show`)}
      rowClassName={() => "[&_td]:py-2.5"}
    >
      <DataTable.Col source="subject" label="Subject" />
      <DataTable.Col
        source="status"
        label="Status"
        render={(record: Ticket) => (
          <Badge variant="outline" className="capitalize">
            {record.status}
          </Badge>
        )}
      />
      <DataTable.Col
        source="priority"
        label="Priority"
        render={(record: Ticket) => (
          <Badge variant="secondary" className="capitalize">
            {record.priority}
          </Badge>
        )}
      />
      <DataTable.Col
        source="company_id"
        label="Client"
        render={(record: Ticket) =>
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
        source="updated_at"
        label="Updated"
        render={(record: Ticket) =>
          record.updated_at
            ? new Date(record.updated_at).toLocaleDateString()
            : "—"
        }
      />
    </DataTable>
  );
};
