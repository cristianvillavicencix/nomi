import { useEffect, useMemo } from "react";
import { useGetIdentity } from "ra-core";
import { KanbanSquare, List as ListIcon } from "lucide-react";
import { useSearchParams } from "react-router";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import {
  PageActions,
  PageTitle,
} from "@/components/atomic-crm/layout/PageActions";
import { AccountsGroupedList } from "@/modules/accounts/AccountsGroupedList";
import {
  canAccessAccountsBoard,
  canAccessAccountsList,
  resolveDefaultAccountsView,
} from "@/modules/accounts/accountsHubAccess";
import {
  buildAccountsHubViewChangeParams,
  parseAccountsHubView,
  persistAccountsView,
  readPersistedAccountsView,
  syncAccountsHubSearchParams,
  type AccountsHubView,
} from "@/modules/accounts/accountsHubSearchParams";
import { AccountsLeadPreviewSheet } from "@/modules/accounts/AccountsLeadPreviewSheet";
import { AccountsCompanyPreviewSheet } from "@/modules/accounts/AccountsCompanyPreviewSheet";
import { LeadsBoardPanel } from "@/modules/leads/LeadsBoardPanel";

/** Accounts hub — List (people-first) | Board (leads Kanban). */
export const AccountsHubPage = () => {
  const { data: identity } = useGetIdentity();
  const [searchParams, setSearchParams] = useSearchParams();

  const canList = useMemo(
    () => canAccessAccountsList(identity),
    [identity],
  );
  const canBoard = useMemo(
    () => canAccessAccountsBoard(identity),
    [identity],
  );

  const requestedView = useMemo(() => {
    const fromUrl = parseAccountsHubView(searchParams.get("view"));
    if (fromUrl) return fromUrl;
    return readPersistedAccountsView();
  }, [searchParams]);

  const activeView = useMemo(
    () => resolveDefaultAccountsView(identity, requestedView),
    [identity, requestedView],
  );

  useEffect(() => {
    if (!activeView) return;
    persistAccountsView(activeView);
    const next = syncAccountsHubSearchParams(activeView, searchParams);
    if (!next || next.toString() === searchParams.toString()) return;
    setSearchParams(next, { replace: true });
  }, [activeView, searchParams, setSearchParams]);

  const handleViewChange = (value: string) => {
    if (value !== "list" && value !== "board") return;
    const view = value as AccountsHubView;
    if (view === "list" && !canList) return;
    if (view === "board" && !canBoard) return;
    persistAccountsView(view);
    const next = buildAccountsHubViewChangeParams(view, searchParams);
    next.delete("contact");
    next.delete("lead");
    next.delete("stage");
    next.delete("company");
    setSearchParams(next, { replace: true });
  };

  if (!identity || !activeView) return null;

  const showToggle = canList && canBoard;

  return (
    <div
      className={
        activeView === "board"
          ? "flex h-full min-h-0 w-full flex-col gap-3"
          : "w-full space-y-3"
      }
    >
      <PageActions>
        <PageTitle label="Accounts" />
        {showToggle ? (
          <ToggleGroup
            type="single"
            value={activeView}
            onValueChange={handleViewChange}
            variant="outline"
            size="sm"
          >
            <ToggleGroupItem value="list" aria-label="List view">
              <ListIcon className="size-4" />
              List
            </ToggleGroupItem>
            <ToggleGroupItem value="board" aria-label="Board view">
              <KanbanSquare className="size-4" />
              Board
            </ToggleGroupItem>
          </ToggleGroup>
        ) : null}
      </PageActions>

      {activeView === "board" ? (
        <div className="min-h-0 flex-1">
          <LeadsBoardPanel embedded />
        </div>
      ) : canList ? (
        <AccountsGroupedList />
      ) : null}

      <AccountsLeadPreviewSheet />
      <AccountsCompanyPreviewSheet />
    </div>
  );
};
