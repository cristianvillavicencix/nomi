import { useState } from "react";
import type { Identifier } from "ra-core";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { Company, Contact } from "@/components/atomic-crm/types";
import { ClientTasksTab } from "@/modules/clients/ClientTabPanels";
import { ClientTabContentCard } from "@/modules/clients/ClientTabSectionCard";
import { formatTabCount } from "@/modules/clients/clientShowUtils";
import { LeadActivityPanel } from "@/modules/leads/LeadActivityPanel";
import { LeadNotesTab } from "@/modules/leads/LeadNotesTab";
import { LeadPipelinePanel } from "@/modules/leads/LeadPipelinePanel";

type LeadCenterTab = "pipeline" | "activity" | "notes" | "tasks";

type LeadCenterContentProps = {
  lead: Contact;
  companyId?: Company["id"];
  contactIds: Identifier[];
  counts: {
    notes: number;
    tasks: number;
  };
};

export const LeadCenterContent = ({
  lead,
  companyId,
  contactIds,
  counts,
}: LeadCenterContentProps) => {
  const [currentTab, setCurrentTab] = useState<LeadCenterTab>("pipeline");

  const tabLabel = (label: string, count?: number) =>
    `${label}${formatTabCount(count)}`;

  return (
    <Card className="gap-0 border-0 py-0 shadow-none">
      <CardContent className="px-4 py-4">
        <Tabs
          value={currentTab}
          onValueChange={(tab) => setCurrentTab(tab as LeadCenterTab)}
        >
          <TabsList className="mb-4 inline-flex h-auto w-full justify-start gap-1 overflow-x-auto rounded-lg bg-muted p-1">
            <TabsTrigger value="pipeline" className="shrink-0">
              Pipeline
            </TabsTrigger>
            <TabsTrigger value="activity" className="shrink-0">
              Activity
            </TabsTrigger>
            <TabsTrigger value="notes" className="shrink-0">
              {tabLabel("Notes", counts.notes)}
            </TabsTrigger>
            <TabsTrigger value="tasks" className="shrink-0">
              {tabLabel("Tasks", counts.tasks)}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="pipeline" className="mt-0">
            <LeadPipelinePanel lead={lead} embedded />
          </TabsContent>

          <TabsContent value="activity" className="mt-0">
            <LeadActivityPanel lead={lead} embedded />
          </TabsContent>

          <TabsContent value="notes" className="mt-0">
            <ClientTabContentCard flush>
              <LeadNotesTab lead={lead} contactIds={contactIds} />
            </ClientTabContentCard>
          </TabsContent>

          <TabsContent value="tasks" className="mt-0">
            <ClientTabContentCard flush>
              <ClientTasksTab
                companyId={companyId}
                contactIds={contactIds}
                primaryContactId={lead.id}
              />
            </ClientTabContentCard>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
};
