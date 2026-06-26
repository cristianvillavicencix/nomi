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
import { useContactTabCounts } from "@/modules/contacts/useContactTabCounts";

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
    if (mapped.tab === "projects") {
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
    if (nextTab === "projects") {
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
          <TabsList className="mb-4 inline-flex h-auto w-full justify-start gap-1 overflow-x-auto rounded-lg bg-muted p-1">
            <TabsTrigger value="projects" className="shrink-0">
              {tabLabel("projects", "Projects", counts.projects)}
            </TabsTrigger>
            <TabsTrigger value="financial" className="shrink-0">
              {tabLabel("financial", "Financial", financialCount)}
            </TabsTrigger>
            <TabsTrigger value="activity" className="shrink-0">
              {tabLabel("activity", "Activity", activityCount)}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="projects" className="mt-0">
            <ClientTabSectionCard
              title="Projects"
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
        </Tabs>
      </CardContent>
    </Card>
  );

  const leftColumn = (
    <ContactSummaryCard record={record} hideCompanyLink={embedded} />
  );

  if (embedded) {
    return (
      <div className="pb-2">
        <div className="space-y-3">
          {leftColumn}
          {centerTabs}
        </div>
      </div>
    );
  }

  const sidebarProps = {
    contact: record,
    counts: {
      deals: counts.deals,
      projects: counts.projects,
      tickets: counts.tickets,
      referrals: counts.referrals,
    },
  };

  const sidebar = isMobile ? (
    <ContactRelatedSidebar {...sidebarProps} />
  ) : (
    <ContactCollapsibleRelatedSidebar {...sidebarProps} />
  );

  return (
    <div className="mt-2 pb-4">
      <ContactShowActions
        record={record}
        onContactUpdated={() => void refetch()}
      />

      {isMobile ? (
        <div className="space-y-4">
          {leftColumn}
          {centerTabs}
          {sidebar}
        </div>
      ) : (
        <div className="grid items-start gap-4 xl:grid-cols-[320px_minmax(0,1fr)_auto]">
          {leftColumn}
          <div className="min-w-0">{centerTabs}</div>
          {sidebar}
        </div>
      )}
    </div>
  );
};
