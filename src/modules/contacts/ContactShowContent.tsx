import { useEffect, useState } from "react";
import { useShowContext } from "ra-core";
import { useSearchParams } from "react-router";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useIsMobile } from "@/hooks/use-mobile";
import type { Contact } from "@/components/atomic-crm/types";
import { ClientActivityTab } from "@/modules/clients/ClientActivityTab";
import { ClientFinancialTab } from "@/modules/clients/ClientFinancialTab";
import { ClientProjectsTab } from "@/modules/clients/ClientTabPanels";
import { ClientTabSectionCard } from "@/modules/clients/ClientTabSectionCard";
import { ClientTabEmpty } from "@/modules/clients/ClientContactsTab";
import {
  DEFAULT_CLIENT_TAB,
  formatTabCount,
  getValidClientTab,
  resolveClientTabFromUrl,
  type ClientTab,
} from "@/modules/clients/clientShowUtils";
import { ContactCollapsibleRelatedSidebar } from "@/modules/contacts/ContactCollapsibleRelatedSidebar";
import { ContactRelatedSidebar } from "@/modules/contacts/ContactRelatedSidebar";
import { ContactShowActions } from "@/modules/contacts/ContactShowActions";
import { ContactSummaryCard } from "@/modules/contacts/ContactSummaryCard";
import { ContactMarketingPreferencesCard } from "@/modules/marketing/ContactMarketingPreferencesCard";
import { useMemberCapability } from "@/components/atomic-crm/providers/commons/useMemberCapability";
import { useContactTabCounts } from "@/modules/contacts/useContactTabCounts";
import { ProfileFullViewLayout } from "@/modules/shared/ProfileFullViewLayout";

export const ContactShowContent = ({
  embedded = false,
}: {
  embedded?: boolean;
} = {}) => {
  const { record, isPending, refetch } = useShowContext<Contact>();
  const [searchParams, setSearchParams] = useSearchParams();
  const isMobile = useIsMobile();
  const [embeddedTab, setEmbeddedTab] = useState<ClientTab>(DEFAULT_CLIENT_TAB);
  const resolved = resolveClientTabFromUrl(searchParams.get("tab"));
  const urlTab = getValidClientTab(resolved.tab);
  const currentTab = embedded ? embeddedTab : urlTab;
  const syncUrl = !embedded;
  const counts = useContactTabCounts(record);
  const canViewMarketing = useMemberCapability("marketing.view");

  useEffect(() => {
    if (embedded) return;
    const rawTab = searchParams.get("tab");
    if (!rawTab) return;
    const mapped = resolveClientTabFromUrl(rawTab);
    if (
      mapped.tab === rawTab &&
      (!mapped.section || mapped.section === searchParams.get("section"))
    ) {
      return;
    }
    const next = new URLSearchParams(searchParams);
    if (mapped.tab === "activity") {
      next.delete("tab");
    } else {
      next.set("tab", mapped.tab);
    }
    if (mapped.section) {
      next.set("section", mapped.section);
    } else if (mapped.tab !== rawTab) {
      next.delete("section");
    }
    setSearchParams(next, { replace: true });
  }, [embedded, searchParams, setSearchParams]);

  if (isPending || !record) return null;

  const handleTabChange = (tab: string) => {
    const nextTab = getValidClientTab(tab);
    if (embedded) {
      setEmbeddedTab(nextTab);
      return;
    }
    const nextSearchParams = new URLSearchParams(searchParams);
    if (nextTab === "activity") {
      nextSearchParams.delete("tab");
    } else {
      nextSearchParams.set("tab", nextTab);
    }
    nextSearchParams.delete("section");
    setSearchParams(nextSearchParams, { replace: true });
  };

  const tabLabel = (_value: ClientTab, label: string, count?: number) =>
    `${label}${formatTabCount(count)}`;

  const financialCount =
    counts.invoices + counts.proposals + counts.contracts + counts.payments;
  const activityCount = counts.notes + counts.tasks;

  const centerTabs = (
    <Card className={cn("gap-0 py-0", embedded && "border-0 shadow-none")}>
      <CardContent className="px-4 py-4">
        <Tabs value={currentTab} onValueChange={handleTabChange}>
          <TabsList className="mb-4 h-auto w-full justify-start gap-0 overflow-x-auto rounded-none border-b border-border bg-transparent p-0">
            <TabsTrigger
              value="activity"
              className="shrink-0 rounded-none border-b-2 border-transparent bg-transparent px-4 py-2.5 shadow-none data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none"
            >
              {tabLabel("activity", "Activity", activityCount)}
            </TabsTrigger>
            <TabsTrigger
              value="deals"
              className="shrink-0 rounded-none border-b-2 border-transparent bg-transparent px-4 py-2.5 shadow-none data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none"
            >
              {tabLabel("deals", "Deals", counts.projects)}
            </TabsTrigger>
            <TabsTrigger
              value="financial"
              className="shrink-0 rounded-none border-b-2 border-transparent bg-transparent px-4 py-2.5 shadow-none data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none"
            >
              {tabLabel("financial", "Financial", financialCount)}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="activity" className="mt-0">
            <ClientActivityTab
              companyId={counts.hasCompany ? counts.companyId : undefined}
              contactIds={counts.contactIds}
              primaryContactId={record.id}
              syncUrl={syncUrl}
              counts={{
                notes: counts.notes,
                tasks: counts.tasks,
              }}
            />
          </TabsContent>
          <TabsContent value="deals" className="mt-0">
            <ClientTabSectionCard
              title="Deals"
              count={counts.projects}
              flush
            >
              <ClientProjectsTab contactId={record.id} />
            </ClientTabSectionCard>
          </TabsContent>
          <TabsContent value="financial" className="mt-0">
            {counts.hasCompany && counts.companyId ? (
              <ClientFinancialTab
                companyId={counts.companyId}
                syncUrl={syncUrl}
                counts={{
                  invoices: counts.invoices,
                  proposals: counts.proposals,
                  contracts: counts.contracts,
                  payments: counts.payments,
                }}
              />
            ) : (
              <ClientTabEmpty message="Link this contact to a company to view financial records." />
            )}
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );

  if (embedded) {
    return (
      <div className="pb-2">
        <div className="space-y-3">
          <ContactSummaryCard record={record} hideCompanyLink />
          {centerTabs}
        </div>
      </div>
    );
  }

  const sidebarProps = {
    contact: record,
    counts: {
      tickets: counts.tickets,
      referrals: counts.referrals,
    },
  };

  const sidebar = isMobile ? (
    <ContactRelatedSidebar {...sidebarProps} />
  ) : (
    <ContactCollapsibleRelatedSidebar {...sidebarProps} />
  );

  const header = (
    <div className="space-y-3">
      <ContactSummaryCard record={record} />
      {canViewMarketing && record.id != null ? (
        <ContactMarketingPreferencesCard
          contactId={Number(record.id)}
          hasNewsletter={record.has_newsletter}
        />
      ) : null}
    </div>
  );

  return (
    <div className="mt-2 pb-4">
      <ContactShowActions
        record={record}
        onContactUpdated={() => void refetch()}
      />

      <ProfileFullViewLayout
        header={header}
        main={centerTabs}
        sidebar={sidebar}
        stacked={isMobile}
      />
    </div>
  );
};
