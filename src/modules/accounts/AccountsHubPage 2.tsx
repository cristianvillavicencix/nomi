import { useEffect, useMemo, useState } from "react";
import { useGetIdentity } from "ra-core";
import { useSearchParams } from "react-router";
import {
  PageActions,
  PageTitle,
} from "@/components/atomic-crm/layout/PageActions";
import { canAccess } from "@/components/atomic-crm/providers/commons/canAccess";
import type { AccessIdentity } from "@/components/atomic-crm/providers/commons/canAccess";
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
import type { AccountsHubChrome } from "@/modules/accounts/AccountsModuleToolbar";
import { AccountsLeadPreviewSheet } from "@/modules/accounts/AccountsLeadPreviewSheet";
import { AccountsCompanyPreviewSheet } from "@/modules/accounts/AccountsCompanyPreviewSheet";
import { NewClientDialog } from "@/modules/clients/NewClientDialog";
import { NewContactDialog } from "@/modules/clients/NewContactDialog";
import { NewLeadDialog } from "@/modules/leads/NewLeadDialog";
import { LeadsBoardPanel } from "@/modules/leads/LeadsBoardPanel";

/** Accounts hub — List (company-first) | Board (leads Kanban). */
export const AccountsHubPage = () => {
  const { data: identity } = useGetIdentity();
  const [searchParams, setSearchParams] = useSearchParams();
  const [companyDialogOpen, setCompanyDialogOpen] = useState(false);
  const [contactDialogOpen, setContactDialogOpen] = useState(false);
  const [leadDialogOpen, setLeadDialogOpen] = useState(false);

  const canList = useMemo(
    () => canAccessAccountsList(identity),
    [identity],
  );
  const canBoard = useMemo(
    () => canAccessAccountsBoard(identity),
    [identity],
  );

  const canCreateCompany = canAccess(identity as AccessIdentity, {
    resource: "companies",
    action: "create",
  });
  const canCreateContact = canAccess(identity as AccessIdentity, {
    resource: "contacts",
    action: "create",
  });

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

  useEffect(() => {
    const create = searchParams.get("create");
    if (create === "company") setCompanyDialogOpen(true);
    else if (create === "lead") setLeadDialogOpen(true);
    else if (create === "contact") setContactDialogOpen(true);
    else return;
    const next = new URLSearchParams(searchParams);
    next.delete("create");
    setSearchParams(next, { replace: true });
  }, [searchParams, setSearchParams]);

  const handleViewChange = (view: AccountsHubView) => {
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

  const chrome: AccountsHubChrome = {
    activeView,
    onViewChange: handleViewChange,
    showToggle: canList && canBoard,
    canCreateCompany,
    canCreateContact,
    onNewCompany: () => setCompanyDialogOpen(true),
    onNewLead: () => setLeadDialogOpen(true),
    onNewContact: () => setContactDialogOpen(true),
  };

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
      </PageActions>

      {activeView === "board" ? (
        <div className="min-h-0 flex-1">
          <LeadsBoardPanel embedded accountsChrome={chrome} />
        </div>
      ) : canList ? (
        <AccountsGroupedList accountsChrome={chrome} />
      ) : null}

      <NewClientDialog
        open={companyDialogOpen}
        onOpenChange={setCompanyDialogOpen}
      />
      <NewLeadDialog open={leadDialogOpen} onOpenChange={setLeadDialogOpen} />
      <NewContactDialog
        open={contactDialogOpen}
        onOpenChange={setContactDialogOpen}
      />

      <AccountsLeadPreviewSheet />
      <AccountsCompanyPreviewSheet />
    </div>
  );
};
