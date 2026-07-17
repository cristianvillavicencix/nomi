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
import { PageActions } from "@/components/atomic-crm/layout/PageActions";
import { ModuleInfoPopover } from "@/components/atomic-crm/layout/ModuleInfoPopover";
import type { Contact } from "@/components/atomic-crm/types";
import { LBS_LEAD_STATUSES_FOR_FILTER } from "@/app/navigation";
import { useIsMobile } from "@/hooks/use-mobile";
import { getLeadShowPath } from "@/app/routing";
import { isAccountsHubEnabled } from "@/lib/featureFlags";
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
};

/**
 * Embeddable leads Kanban board. Same storeKey / filters as legacy `/leads`
 * so redirects from Pipeline bookmarks keep filter state coherent.
 *
 * Active pipeline only:
 * - List filter `status@in` = lead/prospect (+ legacy) — never `client`.
 * - Columns = `LBS_LEAD_KANBAN_BOARD_STAGES` (excludes terminal won/lost).
 * - Convert → `lead_stage=won` + status `client` (DB trigger) drops the card
 *   from this board; client follow-up stays on Anti-Olvido / company, not Kanban.
 *
 * Board card clicks set `lead`/`stage` query params. When embedded under
 * Accounts hub, the shared `AccountsLeadPreviewSheet` owns the overlay;
 * standalone `/leads` keeps a local Sheet.
 */
export const LeadsBoardPanel = ({ embedded = false }: LeadsBoardPanelProps) => {
  const { identity } = useGetIdentity();
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const [searchParams, setSearchParams] = useSearchParams();
  const [dialogOpen, setDialogOpen] = useState(false);

  const hubOwnsPreview = embedded && isAccountsHubEnabled();
  const leadParam = searchParams.get("lead");
  const stageParam = parseKanbanStageParam(searchParams.get("stage"));
  const selectedLeadId = leadParam && stageParam ? leadParam : null;

  useEffect(() => {
    if (searchParams.get("create") === "lead") {
      setDialogOpen(true);
      const next = new URLSearchParams(searchParams);
      next.delete("create");
      setSearchParams(next, { replace: true });
    }
  }, [searchParams, setSearchParams]);

  const clearLeadSelection = () => {
    const next = new URLSearchParams(searchParams);
    next.delete("lead");
    next.delete("stage");
    setSearchParams(next, { replace: true });
  };

  // Sheet overlays don't fit the mobile viewport — go straight to full view.
  // Hub-owned preview handles mobile redirect itself; skip here when embedded.
  useEffect(() => {
    if (hubOwnsPreview) return;
    if (isMobile && selectedLeadId && stageParam) {
      navigate(
        `${getLeadShowPath(selectedLeadId)}?stage=${encodeURIComponent(stageParam)}`,
        { replace: true },
      );
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
          <LeadsBoardActions
            embedded={embedded}
            onNewLead={() => setDialogOpen(true)}
          />
        }
      >
        <LeadsBoardFilterCleanup />
        <LeadsBoardLayout />
      </List>
      <NewLeadDialog open={dialogOpen} onOpenChange={setDialogOpen} />
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
              ? "Leads to follow up. Columns are pipeline stages — drag cards to update. Use List for all people or bill-to companies."
              : "Potential opportunities before they become client contacts."
          }
        />
      </div>
    </PageActions>
  );
};

const LeadsBoardLayout = () => {
  const { isPending } = useListContext<Contact>();

  if (isPending) return null;

  return (
    <div className="h-full min-h-0">
      <LeadsKanban />
    </div>
  );
};

export const parseAccountsBoardStage = (raw: string | null) =>
  parseKanbanStageParam(raw);
