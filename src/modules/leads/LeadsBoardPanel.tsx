import { useEffect, useMemo, useState } from "react";
import { useGetIdentity, useListContext, useListFilterContext } from "ra-core";
import { Plus, UserCheck } from "lucide-react";
import { useNavigate, useSearchParams } from "react-router";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { List } from "@/components/admin/list";
import {
  PageActions,
  PageTitle,
} from "@/components/atomic-crm/layout/PageActions";
import {
  ModuleSearchField,
  ModuleToolbar,
  ModuleToolbarActions,
} from "@/components/atomic-crm/layout/ModuleToolbar";
import type { Contact } from "@/components/atomic-crm/types";
import { LBS_LEAD_STATUSES_FOR_FILTER } from "@/app/navigation";
import { useIsMobile } from "@/hooks/use-mobile";
import { getLeadShowPath } from "@/app/routing";
import {
  AccountsModuleToolbar,
  type AccountsHubChrome,
} from "@/modules/accounts/AccountsModuleToolbar";
import { LeadOverviewPreview } from "@/modules/leads/LeadOverviewPreview";
import { NewLeadDialog } from "@/modules/leads/NewLeadDialog";
import { LeadsKanban } from "@/modules/leads/LeadsKanban";
import { parseKanbanStageParam } from "@/modules/leads/leadKanbanNavigation";

const LEGACY_FOLLOW_UP_FILTER_KEYS = [
  "next_followup_at@lte",
  "lead_stage@nin",
  "lead_stage@not.in",
] as const;

type LeadsBoardPanelProps = {
  /** When true, omit page chrome that Accounts hub already provides. */
  embedded?: boolean;
  /** Accounts hub in-page toolbar (view + creates). Required when embedded. */
  accountsChrome?: AccountsHubChrome;
};

/**
 * Embeddable leads Kanban board. Same storeKey / filters as legacy `/leads`
 * so redirects from Pipeline bookmarks keep filter state coherent.
 */
export const LeadsBoardPanel = ({
  embedded = false,
  accountsChrome,
}: LeadsBoardPanelProps) => {
  const { identity } = useGetIdentity();
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const [searchParams, setSearchParams] = useSearchParams();
  const [dialogOpen, setDialogOpen] = useState(false);

  const hubOwnsPreview = embedded;
  const leadParam = searchParams.get("lead");
  const stageParam = parseKanbanStageParam(searchParams.get("stage"));
  const selectedLeadId = leadParam && stageParam ? leadParam : null;

  useEffect(() => {
    if (embedded) return;
    if (searchParams.get("create") === "lead") {
      setDialogOpen(true);
      const next = new URLSearchParams(searchParams);
      next.delete("create");
      setSearchParams(next, { replace: true });
    }
  }, [embedded, searchParams, setSearchParams]);

  const clearLeadSelection = () => {
    const next = new URLSearchParams(searchParams);
    next.delete("lead");
    next.delete("stage");
    setSearchParams(next, { replace: true });
  };

  useEffect(() => {
    if (hubOwnsPreview) return;
    if (isMobile && selectedLeadId && stageParam) {
      navigate(getLeadShowPath(selectedLeadId), { replace: true });
    }
  }, [hubOwnsPreview, isMobile, navigate, selectedLeadId, stageParam]);

  if (!identity) return null;

  return (
    <>
      <List
        resource="contacts"
        storeKey="leads.listParams"
        disableSyncWithLocation
        title={false}
        disableBreadcrumb
        perPage={200}
        pagination={false}
        contentScrollable={false}
        className="mt-0 min-h-0 flex-1"
        sort={{ field: "last_seen", order: "DESC" }}
        filterDefaultValues={{
          "status@in": `(${LBS_LEAD_STATUSES_FOR_FILTER.map((status) => `"${status}"`).join(",")})`,
        }}
        actions={
          embedded ? (
            false
          ) : (
            <PageActions>
              <PageTitle label="Leads" />
            </PageActions>
          )
        }
      >
        <LeadsBoardFilterCleanup />
        <LeadsBoardLayout
          embedded={embedded}
          accountsChrome={accountsChrome}
          onNewLead={() => setDialogOpen(true)}
        />
      </List>
      {!embedded ? (
        <NewLeadDialog open={dialogOpen} onOpenChange={setDialogOpen} />
      ) : null}
      {!hubOwnsPreview ? (
        <Sheet
          open={Boolean(selectedLeadId && stageParam) && !isMobile}
          onOpenChange={(open) => {
            if (!open) clearLeadSelection();
          }}
        >
          <SheetContent
            side="right"
            className="w-full gap-0 p-0 sm:max-w-[50vw] [&>button]:hidden"
          >
            <SheetHeader className="sr-only">
              <SheetTitle>Lead preview</SheetTitle>
            </SheetHeader>
            {selectedLeadId && stageParam ? (
              <LeadOverviewPreview
                leadId={selectedLeadId}
                stage={stageParam}
                onClose={clearLeadSelection}
              />
            ) : null}
          </SheetContent>
        </Sheet>
      ) : null}
    </>
  );
};

/** Drop persisted filters from the removed "Needs follow-up" control. */
export const LeadsBoardFilterCleanup = () => {
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

const LeadsBoardSearchField = () => {
  const { total } = useListContext<Contact>();
  const { filterValues, setFilters } = useListFilterContext();
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
    <ModuleSearchField
      value={searchDraft}
      onChange={setSearchDraft}
      basePlaceholder="Search leads by name, company, or email"
      total={total}
      itemSingular="lead"
    />
  );
};

const LeadsBoardLayout = ({
  embedded,
  accountsChrome,
  onNewLead,
}: {
  embedded: boolean;
  accountsChrome?: AccountsHubChrome;
  onNewLead: () => void;
}) => {
  const { isPending } = useListContext<Contact>();

  if (isPending) return null;

  return (
    <div className="flex h-full min-h-0 flex-col gap-3">
      {embedded && accountsChrome ? (
        <AccountsModuleToolbar
          {...accountsChrome}
          leadingExtra={
            <div className="flex min-w-0 items-center gap-2">
              <LeadsBoardSearchField />
              <MyLeadsFilterButton />
            </div>
          }
        />
      ) : !embedded ? (
        <ModuleToolbar className="shrink-0">
          <LeadsBoardSearchField />
          <ModuleToolbarActions>
            <MyLeadsFilterButton />
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
      ) : null}
      <div className="min-h-0 flex-1">
        <LeadsKanban />
      </div>
    </div>
  );
};

export const parseAccountsBoardStage = (raw: string | null) =>
  parseKanbanStageParam(raw);
