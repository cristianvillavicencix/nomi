import { useShowContext } from "ra-core";
import { useIsMobile } from "@/hooks/use-mobile";
import { cn } from "@/lib/utils";
import type { Contact } from "@/components/atomic-crm/types";
import { useContactTabCounts } from "@/modules/contacts/useContactTabCounts";
import { LeadCenterContent } from "@/modules/leads/LeadCenterContent";
import { LeadCollapsibleRelatedSidebar } from "@/modules/leads/LeadCollapsibleRelatedSidebar";
import { LeadRelatedSidebar } from "@/modules/leads/LeadRelatedSidebar";
import { LeadShowActions } from "@/modules/leads/LeadShowActions";
import { LeadSummaryCard } from "@/modules/leads/LeadSummaryCard";

import type { LeadStageId } from "@/modules/leads/leadStages";

export const LeadShowContent = ({
  embedded = false,
  kanbanStage = null,
}: {
  embedded?: boolean;
  kanbanStage?: LeadStageId | null;
}) => {
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

  const useStackedLayout = isMobile;

  return (
    <div className={cn("mt-2 pb-4", embedded && "mt-0 px-4 pb-6 pt-3")}>
      <LeadShowActions
        record={record}
        embedded={embedded}
        kanbanStage={kanbanStage}
      />

      {useStackedLayout ? (
        <div className="space-y-4">
          <LeadSummaryCard record={record} />
          {centerColumn}
          {sidebar}
        </div>
      ) : (
        <div
          className={cn(
            "grid items-start gap-4",
            embedded
              ? "lg:grid-cols-[minmax(220px,280px)_minmax(0,1fr)_auto]"
              : "xl:grid-cols-[320px_minmax(0,1fr)_auto]",
          )}
        >
          <LeadSummaryCard record={record} />
          {centerColumn}
          {sidebar}
        </div>
      )}
    </div>
  );
};
