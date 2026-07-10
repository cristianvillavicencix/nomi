import { useMemo } from "react";
import { Server } from "lucide-react";
import { useSearchParams } from "react-router";

import {
  PageLayout,
  ScrollableContentArea,
} from "@/components/atomic-crm/layout/page-shell";
import { ModuleInfoPopover } from "@/components/atomic-crm/layout/ModuleInfoPopover";
import {
  PageActions,
  PageTitle,
} from "@/components/atomic-crm/layout/PageActions";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { HostingerDomainsTab } from "@/modules/hostinger/HostingerDomainsTab";
import { HostingerOverviewTab } from "@/modules/hostinger/HostingerOverviewTab";
import { HostingerSearchTab } from "@/modules/hostinger/HostingerSearchTab";
import {
  HOSTINGER_HUB_TAB_LABELS,
  HOSTINGER_HUB_TABS,
  resolveHostingerHubTab,
  type HostingerHubTab,
} from "@/modules/hostinger/hostingerHubTabs";

export const HostingerHubPage = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = useMemo(
    () => resolveHostingerHubTab(searchParams),
    [searchParams],
  );

  const handleTabChange = (value: string) => {
    const next = new URLSearchParams(searchParams);
    next.set("tab", value);
    setSearchParams(next, { replace: true });
  };

  return (
    <PageLayout>
      <PageActions>
        <Server className="size-4 shrink-0 text-muted-foreground" />
        <PageTitle label="Hostinger" />
        <ModuleInfoPopover
          title="Hostinger domains"
          description="Sync your Hostinger portfolio, track expirations, link domains to clients, and check availability — without leaving Nomi."
        />
      </PageActions>

      <Tabs
        value={activeTab}
        onValueChange={handleTabChange}
        className="px-4 pt-2"
      >
        <TabsList className="h-auto w-full justify-start gap-1 overflow-x-auto">
          {HOSTINGER_HUB_TABS.map((tab) => (
            <TabsTrigger key={tab} value={tab} className="shrink-0">
              {HOSTINGER_HUB_TAB_LABELS[tab]}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      <ScrollableContentArea className="p-4">
        <TabPanel tab={activeTab} />
      </ScrollableContentArea>
    </PageLayout>
  );
};

const TabPanel = ({ tab }: { tab: HostingerHubTab }) => {
  switch (tab) {
    case "domains":
      return <HostingerDomainsTab />;
    case "search":
      return <HostingerSearchTab />;
    case "overview":
    default:
      return <HostingerOverviewTab />;
  }
};
