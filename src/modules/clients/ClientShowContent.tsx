import { useEffect, useState } from "react";
import { useShowContext } from "ra-core";
import { useSearchParams } from "react-router";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useIsMobile } from "@/hooks/use-mobile";
import type { CompanyWithPrimaryContact } from "@/modules/clients/clientProfile";
import { ClientActivityTab } from "@/modules/clients/ClientActivityTab";
import { ClientAddContactDialog } from "@/modules/clients/ClientAddContactDialog";
import { ClientEditDialog } from "@/modules/clients/ClientEditDialog";
import { ClientFinancialTab } from "@/modules/clients/ClientFinancialTab";
import { ClientPeopleTab } from "@/modules/clients/ClientPeopleTab";
import { ClientShowActions } from "@/modules/clients/ClientShowActions";
import { ClientSummaryCard } from "@/modules/clients/ClientSummaryCard";
import { ClientProjectsTab, ClientTicketsTab } from "@/modules/clients/ClientTabPanels";
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
  const peopleCount = counts.contacts + counts.leads + counts.referrals;

  const openPrimaryContact = record.primary_contact_id
    ? () => setPrimarySheetOpen(true)
    : undefined;

  const tabTriggerClassName =
    "shrink-0 rounded-none border-b-2 border-transparent bg-transparent px-4 py-2.5 shadow-none data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none";

  const centerTabs = (
    <Card className="gap-0 border-0 py-0 shadow-none">
      <CardContent className="px-4 py-4">
        <Tabs value={currentTab} onValueChange={handleTabChange}>
          <TabsList className="mb-4 h-auto w-full justify-start gap-0 overflow-x-auto rounded-none border-b border-border bg-transparent p-0">
            <TabsTrigger value="activity" className={tabTriggerClassName}>
              {tabLabel("activity", "Activity", activityCount)}
            </TabsTrigger>
            <TabsTrigger value="people" className={tabTriggerClassName}>
              {tabLabel("people", "People", peopleCount)}
            </TabsTrigger>
            <TabsTrigger value="deals" className={tabTriggerClassName}>
              {tabLabel("deals", "Projects", counts.projects)}
            </TabsTrigger>
            <TabsTrigger value="financial" className={tabTriggerClassName}>
              {tabLabel("financial", "Financial", financialCount)}
            </TabsTrigger>
            <TabsTrigger value="tickets" className={tabTriggerClassName}>
              {tabLabel("tickets", "Tickets", counts.tickets)}
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
          <TabsContent value="people" className="mt-0">
            <ClientPeopleTab
              companyId={record.id}
              primaryContactId={record.primary_contact_id}
              counts={{
                contacts: counts.contacts,
                leads: counts.leads,
                referrals: counts.referrals,
              }}
              onAddContact={() => setAddContactOpen(true)}
            />
          </TabsContent>
          <TabsContent value="deals" className="mt-0">
            <ClientTabSectionCard title="Projects" count={counts.projects} flush>
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
          <TabsContent value="tickets" className="mt-0">
            <ClientTabSectionCard
              title="Tickets"
              count={counts.tickets}
              flush
            >
              <ClientTicketsTab companyId={record.id} />
            </ClientTabSectionCard>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
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
        contactId={record.primary_contact_id ?? null}
        open={primarySheetOpen}
        onOpenChange={setPrimarySheetOpen}
      />
    </div>
  );
};
