import { useEffect } from "react";
import { useSearchParams } from "react-router";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ActivityLog } from "@/components/atomic-crm/activity/ActivityLog";
import type { Company } from "@/components/atomic-crm/types";
import type { Identifier } from "ra-core";
import {
  ClientNotesTab,
  ClientSupportTab,
  ClientTasksTab,
} from "@/lbs/clients/ClientTabPanels";
import {
  ACTIVITY_SECTIONS,
  formatTabCount,
  getValidActivitySection,
  type ActivitySection,
} from "@/lbs/clients/clientShowUtils";

type ClientActivityTabProps = {
  companyId: Company["id"];
  contactIds: Identifier[];
  primaryContactId?: Identifier | null;
  counts: {
    notes: number;
    tasks: number;
    tickets: number;
    webForms: number;
  };
};

export const ClientActivityTab = ({
  companyId,
  contactIds,
  primaryContactId,
  counts,
}: ClientActivityTabProps) => {
  const [searchParams, setSearchParams] = useSearchParams();
  const section = getValidActivitySection(searchParams.get("section"));

  const handleSectionChange = (nextSection: string) => {
    const validSection = getValidActivitySection(nextSection);
    const next = new URLSearchParams(searchParams);
    next.set("tab", "activity");
    if (validSection === "feed") {
      next.delete("section");
    } else {
      next.set("section", validSection);
    }
    setSearchParams(next, { replace: true });
  };

  useEffect(() => {
    const tab = searchParams.get("tab");
    if (tab !== "activity") return;
    const rawSection = searchParams.get("section");
    if (
      rawSection &&
      !ACTIVITY_SECTIONS.includes(rawSection as ActivitySection)
    ) {
      const next = new URLSearchParams(searchParams);
      next.delete("section");
      setSearchParams(next, { replace: true });
    }
  }, [searchParams, setSearchParams]);

  const supportCount = counts.tickets + counts.webForms;

  return (
    <Tabs value={section} onValueChange={handleSectionChange}>
      <TabsList className="mb-4 inline-flex h-auto w-max max-w-full justify-start gap-1 overflow-x-auto">
        <TabsTrigger value="feed" className="shrink-0">
          Feed
        </TabsTrigger>
        <TabsTrigger value="notes" className="shrink-0">
          Notes{formatTabCount(counts.notes)}
        </TabsTrigger>
        <TabsTrigger value="tasks" className="shrink-0">
          Tasks{formatTabCount(counts.tasks)}
        </TabsTrigger>
        <TabsTrigger value="support" className="shrink-0">
          Support{formatTabCount(supportCount)}
        </TabsTrigger>
      </TabsList>

      <TabsContent value="feed" className="mt-0">
        <ActivityLog companyId={companyId} context="company" />
      </TabsContent>
      <TabsContent value="notes" className="mt-0">
        <ClientNotesTab
          contactIds={contactIds}
          primaryContactId={primaryContactId}
        />
      </TabsContent>
      <TabsContent value="tasks" className="mt-0">
        <ClientTasksTab
          companyId={companyId}
          contactIds={contactIds}
          primaryContactId={primaryContactId}
        />
      </TabsContent>
      <TabsContent value="support" className="mt-0">
        <ClientSupportTab companyId={companyId} />
      </TabsContent>
    </Tabs>
  );
};
