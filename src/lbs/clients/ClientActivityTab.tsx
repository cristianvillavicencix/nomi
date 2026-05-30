import { useEffect, useState } from "react";
import { useSearchParams } from "react-router";
import { ActivityLog } from "@/components/atomic-crm/activity/ActivityLog";
import type { Company } from "@/components/atomic-crm/types";
import type { Identifier } from "ra-core";
import { ClientNotesTab, ClientTasksTab } from "@/lbs/clients/ClientTabPanels";
import {
  ClientTabAccordion,
  ClientTabAccordionSection,
} from "@/lbs/clients/ClientTabAccordion";
import {
  ClientTabContentCard,
  ClientTabSectionCard,
} from "@/lbs/clients/ClientTabSectionCard";
import {
  ACTIVITY_SECTIONS,
  getValidActivitySection,
  type ActivitySection,
} from "@/lbs/clients/clientShowUtils";

type ClientActivityTabProps = {
  companyId?: Company["id"];
  contactIds: Identifier[];
  primaryContactId?: Identifier | null;
  counts: {
    notes: number;
    tasks: number;
  };
  syncUrl?: boolean;
};

export const ClientActivityTab = ({
  companyId,
  contactIds,
  primaryContactId,
  counts,
  syncUrl = true,
}: ClientActivityTabProps) => {
  const [searchParams, setSearchParams] = useSearchParams();
  const sectionFromUrl =
    syncUrl && searchParams.get("tab") === "activity"
      ? getValidActivitySection(searchParams.get("section"))
      : "feed";

  const [openSections, setOpenSections] = useState<string[]>(() => [
    sectionFromUrl,
  ]);

  useEffect(() => {
    if (!syncUrl) return;
    if (searchParams.get("tab") !== "activity") return;
    setOpenSections([getValidActivitySection(searchParams.get("section"))]);
  }, [syncUrl, searchParams.get("tab"), searchParams.get("section")]);

  const handleAccordionChange = (values: string[]) => {
    setOpenSections(values);
    if (!syncUrl) return;
    const next = new URLSearchParams(searchParams);
    next.set("tab", "activity");
    const focused =
      values.find((value) => value !== "feed") ??
      (values.includes("feed") ? "feed" : undefined);
    if (!focused || focused === "feed") {
      next.delete("section");
    } else if (ACTIVITY_SECTIONS.includes(focused as ActivitySection)) {
      next.set("section", focused);
    }
    setSearchParams(next, { replace: true });
  };

  return (
    <ClientTabAccordion value={openSections} onValueChange={handleAccordionChange}>
      <ClientTabAccordionSection value="feed" title="Activity feed">
        <ClientTabSectionCard title="Recent activity">
          {companyId ? (
            <ActivityLog companyId={companyId} context="company" />
          ) : (
            <p className="text-sm text-muted-foreground">
              Link this contact to a company to view the shared activity feed.
            </p>
          )}
        </ClientTabSectionCard>
      </ClientTabAccordionSection>

      <ClientTabAccordionSection
        value="notes"
        title="Notes"
        count={counts.notes}
      >
        <ClientTabContentCard flush>
          <ClientNotesTab
            contactIds={contactIds}
            primaryContactId={primaryContactId}
          />
        </ClientTabContentCard>
      </ClientTabAccordionSection>

      <ClientTabAccordionSection
        value="tasks"
        title="Tasks"
        count={counts.tasks}
      >
        <ClientTabContentCard flush>
          <ClientTasksTab
            companyId={companyId}
            contactIds={contactIds}
            primaryContactId={primaryContactId}
          />
        </ClientTabContentCard>
      </ClientTabAccordionSection>
    </ClientTabAccordion>
  );
};
