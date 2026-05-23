import { useEffect, useState } from "react";
import { useShowContext } from "ra-core";
import { useSearchParams } from "react-router";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  ScrollableContentArea,
  StickyTabsBar,
} from "@/components/atomic-crm/layout/page-shell";
import type { CompanyWithPrimaryContact } from "@/lbs/clients/clientProfile";
import { ClientActivityTab } from "@/lbs/clients/ClientActivityTab";
import { ClientAddContactDialog } from "@/lbs/clients/ClientAddContactDialog";
import { ClientContactsTab } from "@/lbs/clients/ClientContactsTab";
import { ClientFinancialTab } from "@/lbs/clients/ClientFinancialTab";
import { ClientOverviewTab } from "@/lbs/clients/ClientOverviewTab";
import { ClientProfileHeader } from "@/lbs/clients/ClientProfileHeader";
import { ClientProjectsTab } from "@/lbs/clients/ClientTabPanels";
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
  const resolved = resolveClientTabFromUrl(searchParams.get("tab"));
  const currentTab = getValidClientTab(resolved.tab);
  const [addContactOpen, setAddContactOpen] = useState(false);
  const [primarySheetOpen, setPrimarySheetOpen] = useState(false);

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
    if (mapped.tab === "overview") {
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
    if (nextTab === "overview") {
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
  const activityCount =
    counts.notes + counts.tasks + counts.tickets + counts.webForms;

  return (
    <div className="mt-2 space-y-4 pb-2">
      <ClientProfileHeader
        record={record}
        onAddContact={() => setAddContactOpen(true)}
      />

      <Card>
        <CardContent>
          <Tabs value={currentTab} onValueChange={handleTabChange}>
            <StickyTabsBar className="pb-2">
              <TabsList className="inline-flex h-auto w-full justify-start gap-1 overflow-x-auto rounded-lg bg-muted p-1">
                <TabsTrigger value="overview" className="shrink-0">
                  Overview
                </TabsTrigger>
                <TabsTrigger value="contacts" className="shrink-0">
                  {tabLabel("contacts", "Contacts", counts.contacts)}
                </TabsTrigger>
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
            </StickyTabsBar>
            <ScrollableContentArea>
              <TabsContent value="overview" className="pt-4">
                <ClientOverviewTab
                  record={record}
                  onOpenPrimaryContact={
                    record.primary_contact_id
                      ? () => setPrimarySheetOpen(true)
                      : undefined
                  }
                />
              </TabsContent>
              <TabsContent value="contacts" className="pt-4">
                <ClientContactsTab
                  companyId={record.id}
                  primaryContactId={record.primary_contact_id}
                />
              </TabsContent>
              <TabsContent value="projects" className="pt-4">
                <ClientProjectsTab companyId={record.id} />
              </TabsContent>
              <TabsContent value="financial" className="pt-4">
                <ClientFinancialTab
                  companyId={record.id}
                  counts={{
                    proposals: counts.proposals,
                    contracts: counts.contracts,
                    payments: counts.payments,
                  }}
                />
              </TabsContent>
              <TabsContent value="activity" className="pt-4">
                <ClientActivityTab
                  companyId={record.id}
                  contactIds={counts.contactIds}
                  primaryContactId={record.primary_contact_id}
                  counts={{
                    notes: counts.notes,
                    tasks: counts.tasks,
                    tickets: counts.tickets,
                    webForms: counts.webForms,
                  }}
                />
              </TabsContent>
            </ScrollableContentArea>
          </Tabs>
        </CardContent>
      </Card>

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
