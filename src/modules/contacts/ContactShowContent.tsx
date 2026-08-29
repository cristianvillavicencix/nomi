import { useEffect, useState } from "react";
import { useGetOne, useShowContext } from "ra-core";
import { useSearchParams } from "react-router";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useIsMobile } from "@/hooks/use-mobile";
import type { Company, Contact } from "@/components/atomic-crm/types";
import { ClientActivityTab } from "@/modules/clients/ClientActivityTab";
import { ClientFinancialTab } from "@/modules/clients/ClientFinancialTab";
import {
  ClientProjectsTab,
  ClientTicketsTab,
} from "@/modules/clients/ClientTabPanels";
import { ClientTabSectionCard } from "@/modules/clients/ClientTabSectionCard";
import { ClientTabEmpty } from "@/modules/clients/ClientContactsTab";
import {
  DEFAULT_CLIENT_TAB,
  formatTabCount,
  getValidClientTab,
  resolveClientTabFromUrl,
  type ClientTab,
} from "@/modules/clients/clientShowUtils";
import { isLeadLifecycleStatus } from "@/modules/constants/contactStatus";
import { ContactAccountBanner } from "@/modules/contacts/ContactAccountBanner";
import { ContactRelatedAccounts } from "@/modules/contacts/ContactRelatedAccounts";
import { ContactShowActions } from "@/modules/contacts/ContactShowActions";
import { ContactSummaryCard } from "@/modules/contacts/ContactSummaryCard";
import { LeadPipelinePanel } from "@/modules/leads/LeadPipelinePanel";
import { useContactTabCounts } from "@/modules/contacts/useContactTabCounts";
import { deriveContactServiceType } from "@/modules/clients/clientServiceType";
import { ProfileFullViewLayout } from "@/modules/shared/ProfileFullViewLayout";

type ContactCenterTab = "pipeline" | ClientTab;

const BASE_CENTER_TABS = [
  "activity",
  "deals",
  "financial",
  "tickets",
] as const satisfies ReadonlyArray<ClientTab>;

const getValidContactCenterTab = (
  value: string | null,
  isLead: boolean,
): ContactCenterTab => {
  if (isLead && value === "pipeline") return "pipeline";
  if (value === "people") return DEFAULT_CLIENT_TAB;
  const tab = getValidClientTab(value);
  return (BASE_CENTER_TABS as readonly string[]).includes(tab)
    ? tab
    : isLead
      ? "pipeline"
      : DEFAULT_CLIENT_TAB;
};

export const ContactShowContent = ({
  embedded = false,
}: {
  embedded?: boolean;
} = {}) => {
  const { record, isPending, refetch } = useShowContext<Contact>();
  const [searchParams, setSearchParams] = useSearchParams();
  const isMobile = useIsMobile();
  const isLead = isLeadLifecycleStatus(record?.status);
  const defaultTab: ContactCenterTab = isLead ? "pipeline" : DEFAULT_CLIENT_TAB;
  const [embeddedTab, setEmbeddedTab] = useState<ContactCenterTab>(defaultTab);
  const resolved = resolveClientTabFromUrl(searchParams.get("tab"));
  const urlTab = getValidContactCenterTab(
    searchParams.get("tab") === "pipeline" ? "pipeline" : resolved.tab,
    isLead,
  );
  const currentTab = embedded ? embeddedTab : urlTab;
  const syncUrl = !embedded;
  const counts = useContactTabCounts(record);
  const serviceType = deriveContactServiceType({
    interestedService: record?.interested_service,
    dealCount: counts.projects,
    ticketCount: counts.tickets,
    invoiceCount: counts.invoices,
  });

  const { data: company } = useGetOne<Company>(
    "companies",
    { id: record?.company_id as number },
    { enabled: record?.company_id != null },
  );

  useEffect(() => {
    if (embedded) return;
    const rawTab = searchParams.get("tab");
    if (!rawTab) {
      if (isLead) return;
      return;
    }
    if (rawTab === "pipeline") {
      if (!isLead) {
        const next = new URLSearchParams(searchParams);
        next.delete("tab");
        setSearchParams(next, { replace: true });
      }
      return;
    }
    const mapped = resolveClientTabFromUrl(rawTab);
    const nextTab = getValidContactCenterTab(mapped.tab, isLead);
    if (
      nextTab === rawTab &&
      (!mapped.section || mapped.section === searchParams.get("section"))
    ) {
      return;
    }
    const next = new URLSearchParams(searchParams);
    if (nextTab === "activity" || (nextTab === "pipeline" && !rawTab)) {
      if (nextTab === "activity") next.delete("tab");
      else next.set("tab", "pipeline");
    } else if (nextTab === "pipeline") {
      next.set("tab", "pipeline");
    } else {
      next.set("tab", nextTab);
    }
    if (mapped.section && nextTab === mapped.tab) {
      next.set("section", mapped.section);
    } else if (mapped.tab !== rawTab || nextTab !== rawTab) {
      next.delete("section");
    }
    setSearchParams(next, { replace: true });
  }, [embedded, isLead, searchParams, setSearchParams]);

  if (isPending || !record) return null;

  const handleTabChange = (tab: string) => {
    const nextTab = getValidContactCenterTab(tab, isLead);
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
    nextSearchParams.delete("stage");
    setSearchParams(nextSearchParams, { replace: true });
  };

  const tabLabel = (_value: ContactCenterTab, label: string, count?: number) =>
    `${label}${formatTabCount(count)}`;

  const financialCount =
    counts.invoices + counts.proposals + counts.contracts + counts.payments;
  const activityCount = counts.notes + counts.tasks;
  const tabTriggerClassName =
    "shrink-0 rounded-none border-b-2 border-transparent bg-transparent px-4 py-2.5 shadow-none data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none";

  const centerTabs = (
    <Card className={cn("gap-0 py-0", embedded && "border-0 shadow-none")}>
      <CardContent className="px-4 py-4">
        <Tabs value={currentTab} onValueChange={handleTabChange}>
          <TabsList className="mb-4 h-auto w-full justify-start gap-0 overflow-x-auto rounded-none border-b border-border bg-transparent p-0">
            {isLead ? (
              <TabsTrigger value="pipeline" className={tabTriggerClassName}>
                Pipeline
              </TabsTrigger>
            ) : null}
            <TabsTrigger value="activity" className={tabTriggerClassName}>
              {tabLabel("activity", "Activity", activityCount)}
            </TabsTrigger>
            <TabsTrigger value="deals" className={tabTriggerClassName}>
              {tabLabel("deals", "Deals", counts.projects)}
            </TabsTrigger>
            <TabsTrigger value="financial" className={tabTriggerClassName}>
              {tabLabel("financial", "Financial", financialCount)}
            </TabsTrigger>
            <TabsTrigger value="tickets" className={tabTriggerClassName}>
              {tabLabel("tickets", "Tickets", counts.tickets)}
            </TabsTrigger>
          </TabsList>

          {isLead ? (
            <TabsContent value="pipeline" className="mt-0">
              <LeadPipelinePanel lead={record} embedded />
            </TabsContent>
          ) : null}

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
              <ClientTabEmpty message="Link this person to an account to view financial records." />
            )}
          </TabsContent>
          <TabsContent value="tickets" className="mt-0">
            <ClientTabSectionCard title="Tickets" count={counts.tickets} flush>
              <ClientTicketsTab
                contactId={record.id}
                companyId={
                  counts.hasCompany ? counts.companyId : undefined
                }
                scope="contact"
              />
            </ClientTabSectionCard>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );

  if (embedded) {
    return (
      <div className="pb-2">
        <div className="space-y-3">
          <ContactSummaryCard record={record} hideCompanyLink serviceType={serviceType} />
          <ContactRelatedAccounts
            contact={record}
            deals={counts.contactDeals}
          />
          {centerTabs}
        </div>
      </div>
    );
  }

  const accountName =
    record.company_name?.trim() || company?.name?.trim() || null;

  // Match Account Full: identity header + center tabs only (no Related rail / marketing card).
  return (
    <div className="mt-2 pb-4">
      <ContactShowActions
        record={record}
        onContactUpdated={() => void refetch()}
      />

      <ProfileFullViewLayout
        header={
          <div className="space-y-3">
            {record.company_id != null ? (
              <ContactAccountBanner
                companyId={record.company_id}
                companyName={accountName}
              />
            ) : null}
            <ContactSummaryCard record={record} serviceType={serviceType} />
            <ContactRelatedAccounts
              contact={record}
              deals={counts.contactDeals}
            />
          </div>
        }
        main={centerTabs}
        stacked={isMobile}
      />
    </div>
  );
};
