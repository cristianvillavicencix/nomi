import { useGetIdentity, useListContext } from "ra-core";
import { Link, useNavigate } from "react-router";
import { Plus } from "lucide-react";
import { DataTable } from "@/components/admin/data-table";
import { List } from "@/components/admin/list";
import { ListPagination } from "@/components/admin/list-pagination";
import { SortButton } from "@/components/admin/sort-button";
import { TopToolbar } from "@/components/atomic-crm/layout/TopToolbar";
import { ModuleInfoPopover } from "@/components/atomic-crm/layout/ModuleInfoPopover";
import { LBS_PLACEHOLDER_MODULES } from "@/lbs/navigation";
import type { Form } from "@/lbs/types";
import { getWebFormTypeLabel } from "@/lbs/web-forms/webFormLinks";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export const WebFormsList = () => {
  const { identity } = useGetIdentity();
  if (!identity) return null;

  return (
    <List
      resource="forms"
      title="Web Forms"
      disableBreadcrumb
      perPage={25}
      sort={{ field: "name", order: "ASC" }}
      actions={<WebFormsListActions />}
      pagination={<ListPagination rowsPerPageOptions={[10, 25, 50]} />}
    >
      <WebFormsListLayout />
    </List>
  );
};

const WebFormsListActions = () => (
  <TopToolbar className="w-full flex-wrap items-center justify-end gap-3">
    <SortButton fields={["name", "slug", "updated_at"]} />
    <Button type="button" variant="outline" asChild>
      <Link to="/web-forms/create">
        <Plus className="size-4" />
        New form
      </Link>
    </Button>
    <ModuleInfoPopover
      title={LBS_PLACEHOLDER_MODULES.webForms.title}
      description="Manage client-facing forms for project briefs and file uploads."
    />
  </TopToolbar>
);

const WebFormsListLayout = () => {
  const { data, isPending, filterValues } = useListContext<Form>();
  const navigate = useNavigate();
  const hasFilters = filterValues && Object.keys(filterValues).length > 0;

  if (isPending) return null;

  if (!data?.length && !hasFilters) {
    return (
      <p className="py-8 text-center text-sm text-muted-foreground">
        No web forms configured yet.
      </p>
    );
  }

  return (
    <DataTable
      rowClick={(id) => navigate(`/web-forms/${id}/show`)}
      rowClassName={() => "[&_td]:py-2.5"}
    >
      <DataTable.Col source="name" label="Name" />
      <DataTable.Col
        source="slug"
        label="Type"
        render={(record: Form) => (
          <Badge variant="outline">{getWebFormTypeLabel(record.slug)}</Badge>
        )}
      />
      <DataTable.Col
        source="active"
        label="Status"
        render={(record: Form) => (
          <Badge variant={record.active ? "default" : "outline"}>
            {record.active ? "Active" : "Inactive"}
          </Badge>
        )}
      />
      <DataTable.Col
        source="description"
        label="Description"
        render={(record: Form) => record.description || "—"}
      />
      <DataTable.Col
        label=""
        render={(record: Form) => (
          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={(event) => {
                event.stopPropagation();
                navigate(`/web-forms/${record.id}/show`);
              }}
            >
              Send
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              asChild
              onClick={(event) => event.stopPropagation()}
            >
              <Link to={`/web-forms/${record.id}/edit`}>Edit</Link>
            </Button>
          </div>
        )}
      />
    </DataTable>
  );
};
