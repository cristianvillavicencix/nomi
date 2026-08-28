import { useShowContext, useGetOne } from "ra-core";
import { useIsMobile } from "@/hooks/use-mobile";
import { cn } from "@/lib/utils";
import type { Company, Contact } from "@/components/atomic-crm/types";
import { useContactTabCounts } from "@/modules/contacts/useContactTabCounts";
import { ContactAccountBanner } from "@/modules/contacts/ContactAccountBanner";
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
  const { data: company } = useGetOne<Company>(
    "companies",
    { id: record?.company_id as number },
    { enabled: record?.company_id != null && !embedded },
  );

  if (isPending || !record) return null;

  const accountName =
    record.company_name?.trim() || company?.name?.trim() || null;

  const accountBanner =
    !embedded && record.company_id != null ? (
      <ContactAccountBanner
        companyId={record.company_id}
        companyName={accountName}
      />
    ) : null;

  const centerColumn = (
    <LeadCenterContent
      lead={record}
      companyId={counts.hasCompany ? counts.companyId : undefined}
      contactIds={counts.contactIds}
      counts={{
        notes: counts.notes,
        tasks: counts.tasks,
        tickets: counts.tickets,
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
          {accountBanner}
          <LeadSummaryCard record={record} />
          {centerColumn}
          {sidebar}
        </div>
      ) : (
        <div className="space-y-4">
          {accountBanner}
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
        </div>
      )}
    </div>
  );
};
