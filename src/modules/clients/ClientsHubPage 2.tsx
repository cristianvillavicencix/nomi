import { useEffect, useMemo } from "react";
import { useGetIdentity } from "ra-core";
import { useLocation, useNavigate, useSearchParams } from "react-router";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  PageActions,
  PageTitle,
} from "@/components/atomic-crm/layout/PageActions";
import { CompaniesListPage } from "@/modules/clients/CompaniesListPage";
import { ContactsListPage } from "@/modules/clients/ContactsListPage";
import {
  getAccessibleClientsHubTabs,
  resolveDefaultClientsHubTab,
} from "@/modules/clients/clientsHubAccess";
import {
  getClientsHubTabNavigateTarget,
  syncClientsHubSearchParams,
} from "@/modules/clients/clientsHubSearchParams";
import {
  resolveClientsHubTab,
  type ClientsHubTab,
} from "@/modules/clients/clientsHubTabs";

const TAB_LABELS: Record<ClientsHubTab, string> = {
  companies: "Companies",
  people: "People",
};

/** Clients hub — unified Companies | People lists (`/clients`, `/companies`, `/contacts`). */
export const ClientsHubPage = () => {
  const { data: identity } = useGetIdentity();
  const location = useLocation();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const accessibleTabs = useMemo(
    () => getAccessibleClientsHubTabs(identity),
    [identity],
  );

  const requestedTab = useMemo(
    () =>
      resolveClientsHubTab({
        pathname: location.pathname,
        searchParams,
      }),
    [location.pathname, searchParams],
  );

  const activeTab = useMemo(
    () => resolveDefaultClientsHubTab(identity, requestedTab),
    [identity, requestedTab],
  );

  useEffect(() => {
    if (!activeTab) return;
    const next = syncClientsHubSearchParams(activeTab, searchParams);
    if (!next || next.toString() === searchParams.toString()) return;
    setSearchParams(next, { replace: true });
  }, [activeTab, searchParams, setSearchParams]);

  const handleTabChange = (value: string) => {
    const tab = value as ClientsHubTab;
    if (!accessibleTabs.includes(tab)) return;

    const target = getClientsHubTabNavigateTarget(
      tab,
      location.pathname,
      searchParams,
    );
    if (target.type === "pathname") {
      navigate(target.path, { replace: true });
      return;
    }
    setSearchParams(target.params, { replace: true });
  };

  if (!identity || !activeTab) return null;

  return (
    <div className="w-full space-y-3">
      <PageActions>
        <PageTitle label="Clients" />
      </PageActions>

      <Tabs
        value={activeTab}
        onValueChange={accessibleTabs.length > 1 ? handleTabChange : undefined}
      >
        <TabsList className="mb-0 h-auto w-full justify-start gap-1 overflow-x-auto rounded-lg bg-muted p-1">
          {accessibleTabs.map((tab) => (
            <TabsTrigger key={tab} value={tab} className="shrink-0">
              {TAB_LABELS[tab]}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      {activeTab === "companies" ? (
        <CompaniesListPage embedded />
      ) : (
        <ContactsListPage embedded />
      )}
    </div>
  );
};
