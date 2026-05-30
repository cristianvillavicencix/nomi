import { useEffect, useMemo, useState } from "react";
import { useGetIdentity, useListContext, useListFilterContext } from "ra-core";
import {
  History,
  KanbanSquare,
  List as ListIcon,
  Plus,
  UserCheck,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { DataTable } from "@/components/admin/data-table";
import { List } from "@/components/admin/list";
import { SortButton } from "@/components/admin/sort-button";
import {
  PageActions,
  PageTitle,
} from "@/components/atomic-crm/layout/PageActions";
import { ModuleInfoPopover } from "@/components/atomic-crm/layout/ModuleInfoPopover";
import { Avatar } from "@/components/atomic-crm/contacts/Avatar";
import { ContactEmpty } from "@/components/atomic-crm/contacts/ContactEmpty";
import type { Contact } from "@/components/atomic-crm/types";
import { LBS_LEAD_STATUSES } from "@/lbs/navigation";
import { getLeadShowPath } from "@/lbs/routing";
import { Status } from "@/components/atomic-crm/misc/Status";
import { NewLeadDialog } from "@/lbs/leads/NewLeadDialog";
import { LeadActivitySheet } from "@/lbs/leads/LeadActivitySheet";
import { LeadsKanban } from "@/lbs/leads/LeadsKanban";
import {
  formatFollowUpDate,
  isFollowUpOverdue,
} from "@/lbs/leads/leadFollowUpUtils";
import { getLeadStageDef, normalizeLeadStage } from "@/lbs/leads/leadStages";
import { cn } from "@/lib/utils";

const VIEW_STORAGE_KEY = "lbs.leads.view";
const LEGACY_FOLLOW_UP_FILTER_KEYS = [
  "next_followup_at@lte",
  "lead_stage@nin",
  "lead_stage@not.in",
] as const;
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
        title={false}
        disableBreadcrumb
        perPage={view === "kanban" ? 200 : 25}
        pagination={view === "kanban" ? false : undefined}
        contentScrollable={view !== "kanban"}
        className={view === "kanban" ? "mt-0 min-h-0 flex-1" : undefined}
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
        <LeadsListFilterCleanup />
        <LeadsListLayout view={view} />
      </List>
      <NewLeadDialog open={dialogOpen} onOpenChange={setDialogOpen} />
    </>
  );
};

/** Drop persisted filters from the removed "Needs follow-up" control. */
const LeadsListFilterCleanup = () => {
  const { filterValues, displayedFilters, setFilters } = useListFilterContext();

  useEffect(() => {
    const next = { ...(filterValues ?? {}) };
    let changed = false;
    for (const key of LEGACY_FOLLOW_UP_FILTER_KEYS) {
      if (key in next) {
        delete next[key];
        changed = true;
      }
    }
    if (changed) {
      setFilters(next, displayedFilters);
    }
  }, [displayedFilters, filterValues, setFilters]);

  return null;
};

const LeadsListActions = ({
  onNewLead,
  view,
  onViewChange,
}: {
  onNewLead: () => void;
  view: LeadsView;
  onViewChange: (view: LeadsView) => void;
}) => {
  const { total } = useListContext<Contact>();
  const { identity } = useGetIdentity();
  const { filterValues, displayedFilters, setFilters } = useListFilterContext();

  const myFilterKey = "assigned_member_ids@cs";
  const myFilterActive = useMemo(() => {
    const value = filterValues?.[myFilterKey];
    if (value == null || identity?.id == null) return false;
    return String(value) === `{${identity.id}}`;
  }, [filterValues, identity?.id]);

  const toggleMyLeads = () => {
    if (identity?.id == null) return;
    const next = { ...(filterValues ?? {}) };
    if (myFilterActive) {
      delete next[myFilterKey];
    } else {
      next[myFilterKey] = `{${identity.id}}`;
    }
    setFilters(next, displayedFilters);
  };

  return (
    <PageActions>
      <PageTitle label="Leads" count={total ?? null} />
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
      >
        <ToggleGroupItem value="table" aria-label="Table view">
          <ListIcon className="size-4" />
          Table
        </ToggleGroupItem>
        <ToggleGroupItem value="kanban" aria-label="Vista Kanban">
          <KanbanSquare className="size-4" />
          Kanban
        </ToggleGroupItem>
      </ToggleGroup>
      <Button
        type="button"
        variant={myFilterActive ? "default" : "outline"}
        size="sm"
        onClick={toggleMyLeads}
        disabled={identity?.id == null}
        title={
          myFilterActive ? "Showing only your leads" : "Filter to your leads only"
        }
      >
        <UserCheck className="size-4" />
        {myFilterActive ? "My leads" : "All"}
      </Button>
      <div className="ml-auto flex items-center gap-2">
        {view === "table" ? (
          <SortButton fields={["first_name", "last_name", "last_seen"]} />
        ) : null}
        <Button variant="outline" size="sm" onClick={onNewLead}>
          <Plus className="size-4" />
          New lead
        </Button>
        <ModuleInfoPopover
          title="Leads"
          description="Potential opportunities before they become client contacts."
        />
      </div>
    </PageActions>
  );
};

const LeadsListLayout = ({ view }: { view: LeadsView }) => {
  const { data, isPending } = useListContext<Contact>();
  const [activityLead, setActivityLead] = useState<Contact | null>(null);
  const [activityOpen, setActivityOpen] = useState(false);

  const openActivityHistory = (lead: Contact) => {
    setActivityLead(lead);
    setActivityOpen(true);
  };

  if (isPending) return null;
  if (view === "kanban") {
    return <div className="h-full min-h-0"><LeadsKanban /></div>;
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
          render={(record: Contact) => {
            const fullName =
              `${record.first_name ?? ""} ${record.last_name ?? ""}`.trim() ||
              "—";

            return (
              <div className="flex min-w-0 items-center gap-1">
                <span className="min-w-0 flex-1 truncate">{fullName}</span>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="size-7 shrink-0 text-muted-foreground hover:text-foreground"
                  title="Activity history"
                  onClick={(event) => {
                    event.stopPropagation();
                    openActivityHistory(record);
                  }}
                >
                  <History className="size-3.5" />
                  <span className="sr-only">Activity history</span>
                </Button>
              </div>
            );
          }}
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
          source="lead_stage"
          label="Stage"
          render={(record: Contact) => {
            const stage = getLeadStageDef(normalizeLeadStage(record.lead_stage));
            return (
              <span
                className="text-sm font-medium"
                style={{ color: stage.color }}
              >
                {stage.label}
              </span>
            );
          }}
        />
        <DataTable.Col
          source="next_followup_at"
          label="Follow-up"
          render={(record: Contact) => {
            const label = formatFollowUpDate(record.next_followup_at);
            if (!label) return "—";
            const overdue = isFollowUpOverdue(record.next_followup_at);
            return (
              <span
                className={cn(
                  "text-sm",
                  overdue && "font-medium text-destructive",
                )}
              >
                {label}
              </span>
            );
          }}
        />
        <DataTable.Col
          source="status"
          label="Status"
          render={(record: Contact) => <Status status={record.status} />}
        />
      </DataTable>
      <LeadActivitySheet
        lead={activityLead}
        open={activityOpen}
        onOpenChange={setActivityOpen}
      />
    </>
  );
};
