import { useEffect, useMemo, useState } from "react";
import { useGetIdentity, useListContext, useListFilterContext } from "ra-core";
import { Plus, UserCheck } from "lucide-react";
import { useSearchParams } from "react-router";
import { Button } from "@/components/ui/button";
import { List } from "@/components/admin/list";
import { PageActions } from "@/components/atomic-crm/layout/PageActions";
import { ModuleInfoPopover } from "@/components/atomic-crm/layout/ModuleInfoPopover";
import type { Contact } from "@/components/atomic-crm/types";
import { LBS_LEAD_STATUSES_FOR_FILTER } from "@/app/navigation";
import { NewLeadDialog } from "@/modules/leads/NewLeadDialog";
import { LeadsKanban } from "@/modules/leads/LeadsKanban";
import { LeadsKanbanSplitLayout } from "@/modules/leads/LeadsKanbanSplitLayout";
import { parseKanbanStageParam } from "@/modules/leads/leadKanbanNavigation";
import type { LeadStageId } from "@/modules/leads/leadStages";

const LEGACY_FOLLOW_UP_FILTER_KEYS = [
  "next_followup_at@lte",
  "lead_stage@nin",
  "lead_stage@not.in",
] as const;

type LeadsBoardPanelProps = {
  /** When true, omit page chrome that Accounts hub already provides. */
  embedded?: boolean;
  selectedLeadId?: string | null;
  kanbanStage?: LeadStageId | null;
};

/**
 * Embeddable leads Kanban board. Same storeKey / filters as legacy `/leads`
 * so redirects from Pipeline bookmarks keep filter state coherent.
 */
export const LeadsBoardPanel = ({
  embedded = false,
  selectedLeadId = null,
  kanbanStage = null,
}: LeadsBoardPanelProps) => {
  const { identity } = useGetIdentity();
  const [searchParams, setSearchParams] = useSearchParams();
  const [dialogOpen, setDialogOpen] = useState(false);

  useEffect(() => {
    if (searchParams.get("create") === "lead") {
      setDialogOpen(true);
      const next = new URLSearchParams(searchParams);
      next.delete("create");
      setSearchParams(next, { replace: true });
    }
  }, [searchParams, setSearchParams]);

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
          <LeadsBoardActions
            embedded={embedded}
            onNewLead={() => setDialogOpen(true)}
          />
        }
      >
        <LeadsBoardFilterCleanup />
        <LeadsBoardLayout
          selectedLeadId={selectedLeadId}
          kanbanStage={kanbanStage}
        />
      </List>
      <NewLeadDialog open={dialogOpen} onOpenChange={setDialogOpen} />
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

const LeadsBoardActions = ({
  embedded,
  onNewLead,
}: {
  embedded: boolean;
  onNewLead: () => void;
}) => {
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
      <Button
        type="button"
        variant={myFilterActive ? "default" : "outline"}
        size="sm"
        onClick={toggleMyLeads}
        disabled={identity?.id == null}
        title={
          myFilterActive
            ? "Showing only your leads"
            : "Filter to your leads only"
        }
      >
        <UserCheck className="size-4" />
        {myFilterActive ? "My leads" : "All"}
      </Button>
      <div className="ml-auto flex items-center gap-2">
        <Button variant="outline" size="sm" onClick={onNewLead}>
          <Plus className="size-4" />
          New lead
        </Button>
        <ModuleInfoPopover
          title={embedded ? "Accounts pipeline" : "Leads"}
          description={
            embedded
              ? "Pipeline board for people/opportunities. Columns are lead stages — companies stay on the List view as bill-to accounts."
              : "Potential opportunities before they become client contacts."
          }
        />
      </div>
    </PageActions>
  );
};

const LeadsBoardLayout = ({
  selectedLeadId,
  kanbanStage,
}: {
  selectedLeadId?: string | null;
  kanbanStage?: LeadStageId | null;
}) => {
  const { isPending } = useListContext<Contact>();

  if (isPending) return null;

  if (selectedLeadId && kanbanStage) {
    return (
      <LeadsKanbanSplitLayout
        selectedLeadId={selectedLeadId}
        stage={kanbanStage}
      />
    );
  }

  return (
    <div className="h-full min-h-0">
      <LeadsKanban />
    </div>
  );
};

export const parseAccountsBoardStage = (raw: string | null) =>
  parseKanbanStageParam(raw);
