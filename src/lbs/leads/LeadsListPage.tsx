import { useEffect, useState } from "react";
import { useGetIdentity, useListContext } from "ra-core";
import { KanbanSquare, List as ListIcon, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { DataTable } from "@/components/admin/data-table";
import { List } from "@/components/admin/list";
import { SortButton } from "@/components/admin/sort-button";
import { TopToolbar } from "@/components/atomic-crm/layout/TopToolbar";
import { ModuleInfoPopover } from "@/components/atomic-crm/layout/ModuleInfoPopover";
import { SpotlightSearchButton } from "@/components/atomic-crm/layout/SpotlightSearchButton";
import { Avatar } from "@/components/atomic-crm/contacts/Avatar";
import { ContactEmpty } from "@/components/atomic-crm/contacts/ContactEmpty";
import { InfinitePagination } from "@/components/atomic-crm/misc/InfinitePagination";
import type { Contact } from "@/components/atomic-crm/types";
import { LBS_LEAD_STATUSES } from "@/lbs/navigation";
import { getLeadShowPath } from "@/lbs/routing";
import { Status } from "@/components/atomic-crm/misc/Status";
import { NewLeadDialog } from "@/lbs/leads/NewLeadDialog";
import { LeadsKanban } from "@/lbs/leads/LeadsKanban";

const VIEW_STORAGE_KEY = "lbs.leads.view";
type LeadsView = "table" | "kanban";

const readPersistedView = (): LeadsView => {
  if (typeof window === "undefined") return "table";
  const stored = window.localStorage.getItem(VIEW_STORAGE_KEY);
  return stored === "kanban" ? "kanban" : "table";
};

const getPrimaryPhone = (contact: Contact) =>
  contact.phone_jsonb?.find((phone) => String(phone.number ?? "").trim())
    ?.number ?? "—";

const getPrimaryEmail = (contact: Contact) =>
  contact.email_jsonb?.find((email) => String(email.email ?? "").trim())
    ?.email ?? "—";

export const LeadsListPage = () => {
  const { identity } = useGetIdentity();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [view, setView] = useState<LeadsView>(() => readPersistedView());

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(VIEW_STORAGE_KEY, view);
  }, [view]);

  if (!identity) return null;

  return (
    <>
      <List
        resource="contacts"
        title="Leads"
        disableBreadcrumb
        perPage={view === "kanban" ? 200 : 25}
        sort={{ field: "last_seen", order: "DESC" }}
        filterDefaultValues={{
          "status@in": `(${LBS_LEAD_STATUSES.map((status) => `"${status}"`).join(",")})`,
        }}
        actions={
          <LeadsListActions
            onNewLead={() => setDialogOpen(true)}
            view={view}
            onViewChange={setView}
          />
        }
      >
        <LeadsListLayout view={view} />
      </List>
      <NewLeadDialog open={dialogOpen} onOpenChange={setDialogOpen} />
    </>
  );
};

const LeadsListActions = ({
  onNewLead,
  view,
  onViewChange,
}: {
  onNewLead: () => void;
  view: LeadsView;
  onViewChange: (view: LeadsView) => void;
}) => (
  <TopToolbar className="w-full flex-wrap items-center justify-end gap-3">
    <ToggleGroup
      type="single"
      value={view}
      onValueChange={(value) => {
        if (value === "table" || value === "kanban") {
          onViewChange(value);
        }
      }}
      variant="outline"
      size="sm"
      className="mr-auto"
    >
      <ToggleGroupItem value="table" aria-label="Vista tabla">
        <ListIcon className="size-4" />
        Tabla
      </ToggleGroupItem>
      <ToggleGroupItem value="kanban" aria-label="Vista Kanban">
        <KanbanSquare className="size-4" />
        Kanban
      </ToggleGroupItem>
    </ToggleGroup>
    <SpotlightSearchButton
      title="Buscar leads"
      placeholder="Buscar por nombre, empresa, email o teléfono…"
      resource="contacts"
      filter={{
        "status@in": `(${LBS_LEAD_STATUSES.map((status) => `"${status}"`).join(",")})`,
      }}
      getHref={(record) => getLeadShowPath(record.id)}
      renderItem={(record) => {
        const lead = record as Contact;
        const name =
          `${lead.first_name ?? ""} ${lead.last_name ?? ""}`.trim() ||
          lead.company_name ||
          "Sin nombre";
        return (
          <>
            <Avatar record={lead} width={28} />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">{name}</p>
              <p className="truncate text-xs text-muted-foreground">
                {[lead.company_name, lead.lead_stage]
                  .filter(Boolean)
                  .join(" · ") || "—"}
              </p>
            </div>
          </>
        );
      }}
    />
    {view === "table" ? (
      <SortButton fields={["first_name", "last_name", "last_seen"]} />
    ) : null}
    <Button variant="outline" onClick={onNewLead}>
      <Plus />
      New lead
    </Button>
    <ModuleInfoPopover
      title="Leads"
      description="Potential opportunities before they become client contacts."
    />
  </TopToolbar>
);

const LeadsListLayout = ({ view }: { view: LeadsView }) => {
  const { data, isPending } = useListContext<Contact>();

  if (isPending) return null;
  if (view === "kanban") {
    return <LeadsKanban />;
  }
  if (!data?.length) return <ContactEmpty />;

  return (
    <>
      <DataTable
        rowClick={(_id, _resource, record) => getLeadShowPath(record.id)}
        rowClassName={() => "[&_td]:py-2.5"}
      >
        <DataTable.Col
          label=""
          disableSort
          className="w-[52px]"
          render={(record: Contact) => <Avatar record={record} width={25} />}
        />
        <DataTable.Col
          source="first_name"
          label="Full Name"
          render={(record: Contact) =>
            `${record.first_name ?? ""} ${record.last_name ?? ""}`.trim() || "—"
          }
        />
        <DataTable.Col
          source="company_name"
          label="Business Name"
          render={(record: Contact) => record.company_name?.trim() || "—"}
        />
        <DataTable.Col
          source="interested_service"
          label="Interested Service"
          render={(record: Contact) => record.interested_service ?? "—"}
        />
        <DataTable.Col
          source="lead_source"
          label="Lead Source"
          render={(record: Contact) => record.lead_source ?? "—"}
        />
        <DataTable.Col
          source="phone_jsonb"
          label="Phone"
          render={(record: Contact) => getPrimaryPhone(record)}
        />
        <DataTable.Col
          source="email_jsonb"
          label="Email"
          render={(record: Contact) => getPrimaryEmail(record)}
        />
        <DataTable.Col
          source="status"
          label="Status"
          render={(record: Contact) => <Status status={record.status} />}
        />
      </DataTable>
      <InfinitePagination />
    </>
  );
};
