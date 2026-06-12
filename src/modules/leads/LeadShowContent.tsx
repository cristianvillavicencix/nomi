import { useShowContext } from "ra-core";
import { useIsMobile } from "@/hooks/use-mobile";
import type { Contact } from "@/components/atomic-crm/types";
import { useContactTabCounts } from "@/modules/contacts/useContactTabCounts";
import { LeadCenterContent } from "@/modules/leads/LeadCenterContent";
import { LeadCollapsibleRelatedSidebar } from "@/modules/leads/LeadCollapsibleRelatedSidebar";
import { LeadRelatedSidebar } from "@/modules/leads/LeadRelatedSidebar";
import { LeadShowActions } from "@/modules/leads/LeadShowActions";
import { LeadSummaryCard } from "@/modules/leads/LeadSummaryCard";

export const LeadShowContent = () => {
  const { record, isPending } = useShowContext<Contact>();
  const isMobile = useIsMobile();
  const counts = useContactTabCounts(record);

  if (isPending || !record) return null;

  const centerColumn = (
    <LeadCenterContent
      lead={record}
      companyId={counts.hasCompany ? counts.companyId : undefined}
      contactIds={counts.contactIds}
      counts={{
        notes: counts.notes,
        tasks: counts.tasks,
      }}
    />
  );

  const sidebar = isMobile ? (
    <LeadRelatedSidebar lead={record} />
  ) : (
    <LeadCollapsibleRelatedSidebar lead={record} />
  );

  return (
    <div className="mt-2 pb-4">
      <LeadShowActions record={record} />

      {isMobile ? (
        <div className="space-y-4">
          <LeadSummaryCard record={record} />
          {centerColumn}
          {sidebar}
        </div>
      ) : (
        <div className="grid items-start gap-4 xl:grid-cols-[320px_minmax(0,1fr)_auto]">
          <LeadSummaryCard record={record} />
          {centerColumn}
          {sidebar}
        </div>
      )}
    </div>
  );
};
