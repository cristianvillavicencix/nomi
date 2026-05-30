import { useEffect, useState } from "react";
import { useShowContext, type Identifier } from "ra-core";
import { useSearchParams } from "react-router";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useIsMobile } from "@/hooks/use-mobile";
import type { CompanyWithPrimaryContact } from "@/lbs/clients/clientProfile";
import { ClientActivityTab } from "@/lbs/clients/ClientActivityTab";
import { ClientAddContactDialog } from "@/lbs/clients/ClientAddContactDialog";
import { ClientFinancialTab } from "@/lbs/clients/ClientFinancialTab";
import { ClientCollapsibleRelatedSidebar } from "@/lbs/clients/ClientCollapsibleRelatedSidebar";
import { ClientRelatedSidebar } from "@/lbs/clients/ClientRelatedSidebar";
import { ClientShowActions } from "@/lbs/clients/ClientShowActions";
import { ClientSummaryCard } from "@/lbs/clients/ClientSummaryCard";
import { ClientProjectsTab } from "@/lbs/clients/ClientTabPanels";
import { ClientTabSectionCard } from "@/lbs/clients/ClientTabSectionCard";
import { ContactShowSheet } from "@/lbs/clients/ContactShowSheet";
import {
  formatTabCount,
  getValidClientTab,
  resolveClientTabFromUrl,
  type ClientTab,
} from "@/lbs/clients/clientShowUtils";
import { useClientTabCounts } from "@/lbs/clients/useClientTabCounts";

export const ClientShowContent = () => {
  const { record, isPending } = useShowContext<CompanyWithPrimaryContact>();
  const [searchParams, setSearchParams] = useSearchParams();
  const isMobile = useIsMobile();
  const resolved = resolveClientTabFromUrl(searchParams.get("tab"));
  const currentTab = getValidClientTab(resolved.tab);
  const [addContactOpen, setAddContactOpen] = useState(false);
  const [primarySheetOpen, setPrimarySheetOpen] = useState(false);
  const [sidebarContactId, setSidebarContactId] = useState<Identifier | null>(
    null,
  );

  const counts = useClientTabCounts(record?.id ?? "");

  useEffect(() => {
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
  }, [searchParams, setSearchParams]);

  if (isPending || !record) return null;

  const handleTabChange = (tab: string) => {
    const nextTab = getValidClientTab(tab);
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

  const financialCount = counts.proposals + counts.contracts + counts.payments;
  const activityCount = counts.notes + counts.tasks;

  const openPrimaryContact = record.primary_contact_id
    ? () => setPrimarySheetOpen(true)
    : undefined;

  const centerTabs = (
    <Card className="gap-0 border-0 py-0 shadow-none">
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
            <ClientTabSectionCard title="Projects" count={counts.projects} flush>
              <ClientProjectsTab companyId={record.id} />
            </ClientTabSectionCard>
          </TabsContent>
          <TabsContent value="financial" className="mt-0">
            <ClientFinancialTab
              companyId={record.id}
              counts={{
                proposals: counts.proposals,
                contracts: counts.contracts,
                payments: counts.payments,
              }}
            />
          </TabsContent>
          <TabsContent value="activity" className="mt-0">
            <ClientActivityTab
              companyId={record.id}
              contactIds={counts.contactIds}
              primaryContactId={record.primary_contact_id}
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

  const sidebarProps = {
    companyId: record.id,
    primaryContactId: record.primary_contact_id,
    counts: {
      contacts: counts.contacts,
      leads: counts.leads,
      projects: counts.projects,
      tickets: counts.tickets,
      referrals: counts.referrals,
    },
    onAddContact: () => setAddContactOpen(true),
    onOpenContact: (contactId: Identifier) => {
      setSidebarContactId(contactId);
      setPrimarySheetOpen(true);
    },
  };

  const sidebar = isMobile ? (
    <ClientRelatedSidebar {...sidebarProps} />
  ) : (
    <ClientCollapsibleRelatedSidebar {...sidebarProps} />
  );

  const leftColumn = (
    <ClientSummaryCard
      record={record}
      onOpenPrimaryContact={openPrimaryContact}
    />
  );

  return (
    <div className="mt-2 pb-4">
      <ClientShowActions record={record} />

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

      <ClientAddContactDialog
        companyId={record.id}
        open={addContactOpen}
        onOpenChange={setAddContactOpen}
      />
      <ContactShowSheet
        contactId={sidebarContactId ?? record.primary_contact_id ?? null}
        open={primarySheetOpen}
        onOpenChange={(open) => {
          setPrimarySheetOpen(open);
          if (!open) setSidebarContactId(null);
        }}
      />
    </div>
  );
};
