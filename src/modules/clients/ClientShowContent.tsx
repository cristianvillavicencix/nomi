import { useEffect, useState } from "react";
import { useShowContext, type Identifier } from "ra-core";
import { useSearchParams } from "react-router";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useIsMobile } from "@/hooks/use-mobile";
import type { CompanyWithPrimaryContact } from "@/modules/clients/clientProfile";
import { ClientActivityTab } from "@/modules/clients/ClientActivityTab";
import { ClientAddContactDialog } from "@/modules/clients/ClientAddContactDialog";
import { ClientEditDialog } from "@/modules/clients/ClientEditDialog";
import { ClientFinancialTab } from "@/modules/clients/ClientFinancialTab";
import { ClientCollapsibleRelatedSidebar } from "@/modules/clients/ClientCollapsibleRelatedSidebar";
import { ClientRelatedSidebar } from "@/modules/clients/ClientRelatedSidebar";
import { ClientShowActions } from "@/modules/clients/ClientShowActions";
import { ClientSummaryCard } from "@/modules/clients/ClientSummaryCard";
import { ClientProjectsTab } from "@/modules/clients/ClientTabPanels";
import { ClientTabSectionCard } from "@/modules/clients/ClientTabSectionCard";
import { ContactShowSheet } from "@/modules/clients/ContactShowSheet";
import {
  formatTabCount,
  getValidClientTab,
  resolveClientTabFromUrl,
  type ClientTab,
} from "@/modules/clients/clientShowUtils";
import { useClientTabCounts } from "@/modules/clients/useClientTabCounts";
import { deriveClientServiceType } from "@/modules/clients/clientServiceType";
import { ProfileFullViewLayout } from "@/modules/shared/ProfileFullViewLayout";

export const ClientShowContent = () => {
  const { record, isPending } = useShowContext<CompanyWithPrimaryContact>();
  const [searchParams, setSearchParams] = useSearchParams();
  const isMobile = useIsMobile();
  const resolved = resolveClientTabFromUrl(searchParams.get("tab"));
  const currentTab = getValidClientTab(resolved.tab);
  const [addContactOpen, setAddContactOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [primarySheetOpen, setPrimarySheetOpen] = useState(false);
  const [sidebarContactId, setSidebarContactId] = useState<Identifier | null>(
    null,
  );

  const counts = useClientTabCounts(record?.id ?? "");

  const serviceType = deriveClientServiceType({
    dealCount: counts.projects,
    ticketCount: counts.tickets,
    invoiceCount: counts.invoices,
  });

  useEffect(() => {
    if (searchParams.get("edit") === "1") {
      setEditOpen(true);
    }
  }, [searchParams]);

  const handleEditOpenChange = (open: boolean) => {
    setEditOpen(open);
    if (!open && searchParams.get("edit") === "1") {
      const next = new URLSearchParams(searchParams);
      next.delete("edit");
      setSearchParams(next, { replace: true });
    }
  };

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
  }, [searchParams, setSearchParams]);

  if (isPending || !record) return null;

  const handleTabChange = (tab: string) => {
    const nextTab = getValidClientTab(tab);
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

  const openPrimaryContact = record.primary_contact_id
    ? () => setPrimarySheetOpen(true)
    : undefined;

  const centerTabs = (
    <Card className="gap-0 border-0 py-0 shadow-none">
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
              value="projects"
              className="shrink-0 rounded-none border-b-2 border-transparent bg-transparent px-4 py-2.5 shadow-none data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none"
            >
              {tabLabel("projects", "Projects", counts.projects)}
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
              companyId={record.id}
              contactIds={counts.contactIds}
              primaryContactId={record.primary_contact_id}
              counts={{
                notes: counts.notes,
                tasks: counts.tasks,
              }}
            />
          </TabsContent>
          <TabsContent value="projects" className="mt-0">
            <ClientTabSectionCard
              title="Projects"
              count={counts.projects}
              flush
            >
              <ClientProjectsTab companyId={record.id} />
            </ClientTabSectionCard>
          </TabsContent>
          <TabsContent value="financial" className="mt-0">
            <ClientFinancialTab
              companyId={record.id}
              counts={{
                invoices: counts.invoices,
                proposals: counts.proposals,
                contracts: counts.contracts,
                payments: counts.payments,
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
      deals: counts.deals,
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

  return (
    <div className="mt-2 pb-4">
      <ClientShowActions record={record} onEdit={() => setEditOpen(true)} />

      <ProfileFullViewLayout
        header={
          <ClientSummaryCard
            record={record}
            serviceType={serviceType}
            onOpenPrimaryContact={openPrimaryContact}
          />
        }
        main={centerTabs}
        sidebar={sidebar}
        stacked={isMobile}
      />

      <ClientEditDialog
        companyId={record.id}
        open={editOpen}
        onOpenChange={handleEditOpenChange}
      />
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
