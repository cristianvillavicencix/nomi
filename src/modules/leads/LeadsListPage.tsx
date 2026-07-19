import { useEffect, useMemo, useState } from "react";
import { useGetIdentity, useListContext, useListFilterContext } from "ra-core";
import {
  History,
  KanbanSquare,
  List as ListIcon,
  Plus,
  UserCheck,
} from "lucide-react";
import { useParams, useSearchParams } from "react-router";
import { Button } from "@/components/ui/button";
import { IconButton } from "@/components/ui/icon-button";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { DataTable } from "@/components/admin/data-table";
import { List } from "@/components/admin/list";
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
import { Avatar } from "@/components/atomic-crm/contacts/Avatar";
import { ContactEmpty } from "@/components/atomic-crm/contacts/ContactEmpty";
import type { Contact } from "@/components/atomic-crm/types";
import { LBS_LEAD_STATUSES_FOR_FILTER } from "@/app/navigation";
import { getLeadShowPath } from "@/app/routing";
import { cn } from "@/lib/utils";
import { Status } from "@/components/atomic-crm/misc/Status";
import { NewLeadDialog } from "@/modules/leads/NewLeadDialog";
import { LeadActivitySheet } from "@/modules/leads/LeadActivitySheet";
import { LeadsKanban } from "@/modules/leads/LeadsKanban";
import { LeadsKanbanSplitLayout } from "@/modules/leads/LeadsKanbanSplitLayout";
import { LeadShowStandalone } from "@/modules/leads/LeadShowStandalone";
import { parseKanbanStageParam } from "@/modules/leads/leadKanbanNavigation";
import { useIsMobile } from "@/hooks/use-mobile";
import {
  formatFollowUpDate,
  isFollowUpOverdue,
} from "@/modules/leads/leadFollowUpUtils";
import {
  getLeadStageDef,
  normalizeLeadStage,
  type LeadStageId,
} from "@/modules/leads/leadStages";

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
  const { id: selectedLeadId } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const kanbanStage = parseKanbanStageParam(searchParams.get("stage"));
  const isMobile = useIsMobile();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [view, setView] = useState<LeadsView>(() => readPersistedView());

  const isKanbanSplit =
    Boolean(selectedLeadId) && Boolean(kanbanStage) && !isMobile;
  const isStandaloneShow = Boolean(selectedLeadId) && !kanbanStage;
  const isMobileKanbanShow =
    Boolean(selectedLeadId) && Boolean(kanbanStage) && isMobile;

  useEffect(() => {
    if (kanbanStage && view !== "kanban") {
      setView("kanban");
    }
  }, [kanbanStage, view]);

  useEffect(() => {
    if (searchParams.get("create") === "lead") {
      setDialogOpen(true);
      const next = new URLSearchParams(searchParams);
      next.delete("create");
      setSearchParams(next, { replace: true });
    }
  }, [searchParams, setSearchParams]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(VIEW_STORAGE_KEY, view);
  }, [view]);

  if (!identity) return null;

  if (isStandaloneShow && selectedLeadId) {
    return <LeadShowStandalone contactId={selectedLeadId} />;
  }

  if (isMobileKanbanShow && selectedLeadId && kanbanStage) {
    return (
      <LeadShowStandalone
        contactId={selectedLeadId}
        kanbanStage={kanbanStage}
      />
    );
  }

  return (
    <>
      <List
        resource="contacts"
        storeKey="leads.listParams"
        disableSyncWithLocation
        title={false}
        disableBreadcrumb
        perPage={view === "kanban" ? 200 : 25}
        pagination={view === "kanban" ? false : undefined}
        contentScrollable={view !== "kanban"}
        className={view === "kanban" ? "mt-0 min-h-0 flex-1" : undefined}
        sort={{ field: "last_seen", order: "DESC" }}
        filterDefaultValues={{
          "status@in": `(${LBS_LEAD_STATUSES_FOR_FILTER.map((status) => `"${status}"`).join(",")})`,
        }}
        actions={<LeadsListTitle />}
      >
        <LeadsListFilterCleanup />
        <LeadsListLayout
          view={view}
          onViewChange={setView}
          onNewLead={() => setDialogOpen(true)}
          selectedLeadId={isKanbanSplit ? selectedLeadId! : null}
          kanbanStage={isKanbanSplit ? kanbanStage : null}
        />
      </List>
      <NewLeadDialog open={dialogOpen} onOpenChange={setDialogOpen} />
    </>
  );
};

/** Drop persisted filters from the removed"Needs follow-up" control. */
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

const LeadsListTitle = () => (
  <PageActions>
    <PageTitle label="Leads" />
  </PageActions>
);

const MyLeadsFilterButton = () => {
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
    <Button
      type="button"
      variant={myFilterActive ? "primary" : "secondary"}
      size="sm"
      onClick={toggleMyLeads}
      disabled={identity?.id == null}
      aria-label={myFilterActive ? "My leads" : "All leads"}
      title={
        myFilterActive
          ? "Showing only your leads"
          : "Filter to your leads only"
      }
    >
      <UserCheck className="size-4" />
      {myFilterActive ? "My leads" : "All"}
    </Button>
  );
};

const LeadsListToolbar = ({
  view,
  onViewChange,
  onNewLead,
  searchDraft,
  onSearchDraftChange,
  total,
}: {
  view: LeadsView;
  onViewChange: (view: LeadsView) => void;
  onNewLead: () => void;
  searchDraft: string;
  onSearchDraftChange: (next: string) => void;
  total?: number | null;
}) => (
  <ModuleToolbar className="shrink-0">
    <ModuleSearchField
      value={searchDraft}
      onChange={onSearchDraftChange}
      basePlaceholder="Search leads by name, company, or email"
      total={total}
      itemSingular="lead"
    />
    <ModuleToolbarActions>
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
        className="w-fit shrink-0"
      >
        <ToggleGroupItem value="table" aria-label="List view">
          <ListIcon className="size-4" />
          List
        </ToggleGroupItem>
        <ToggleGroupItem value="kanban" aria-label="Board view">
          <KanbanSquare className="size-4" />
          Board
        </ToggleGroupItem>
      </ToggleGroup>
      <MyLeadsFilterButton />
      {view === "table" ? (
        <SortButton fields={["first_name", "last_name", "last_seen"]} />
      ) : null}
      <Button
        variant="secondary"
        size="sm"
        onClick={onNewLead}
        aria-label="New lead"
      >
        <Plus className="size-4" />
        New lead
      </Button>
    </ModuleToolbarActions>
  </ModuleToolbar>
);

const LeadsListLayout = ({
  view,
  onViewChange,
  onNewLead,
  selectedLeadId,
  kanbanStage,
}: {
  view: LeadsView;
  onViewChange: (view: LeadsView) => void;
  onNewLead: () => void;
  selectedLeadId?: string | null;
  kanbanStage?: LeadStageId | null;
}) => {
  const { data, total, isPending } = useListContext<Contact>();
  const { filterValues, setFilters } = useListFilterContext();
  const [activityLead, setActivityLead] = useState<Contact | null>(null);
  const [activityOpen, setActivityOpen] = useState(false);
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

  const openActivityHistory = (lead: Contact) => {
    setActivityLead(lead);
    setActivityOpen(true);
  };

  const toolbar = (
    <LeadsListToolbar
      view={view}
      onViewChange={onViewChange}
      onNewLead={onNewLead}
      searchDraft={searchDraft}
      onSearchDraftChange={setSearchDraft}
      total={total}
    />
  );

  if (isPending) {
    return toolbar;
  }

  if (view === "kanban") {
    if (selectedLeadId && kanbanStage) {
      return (
        <div className="flex h-full min-h-0 flex-col gap-3">
          {toolbar}
          <div className="min-h-0 flex-1">
            <LeadsKanbanSplitLayout
              selectedLeadId={selectedLeadId}
              stage={kanbanStage}
            />
          </div>
        </div>
      );
    }

    return (
      <div className="flex h-full min-h-0 flex-col gap-3">
        {toolbar}
        <div className="min-h-0 flex-1">
          <LeadsKanban />
        </div>
      </div>
    );
  }

  if (!data?.length) {
    return (
      <div className="space-y-3">
        {toolbar}
        <ContactEmpty />
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {toolbar}
      <DataTable
        rowClick={(_id, _resource, record) => getLeadShowPath(record.id)}
        rowClassName={() => "[&_td]:py-1.5"}
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
                <IconButton
                  className="size-7 shrink-0 text-muted-foreground hover:text-foreground"
                  title="Activity history"
                  onClick={(event) => {
                    event.stopPropagation();
                    openActivityHistory(record);
                  }}
                >
                  <History className="size-3.5" />
                  <span className="sr-only">Activity history</span>
                </IconButton>
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
            const stage = getLeadStageDef(
              normalizeLeadStage(record.lead_stage),
            );
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
    </div>
  );
};
