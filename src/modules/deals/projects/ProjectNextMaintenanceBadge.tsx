import { useMemo } from "react";
import { useGetList } from "ra-core";
import { CalendarClock } from "lucide-react";
import {
  MAINTENANCE_REVIEW_MILESTONE_TITLE,
  formatMaintenanceReviewLabel,
} from "@/modules/deals/projects/delivery/projectMaintenanceReview";
import type { DealMilestone, LbsDeal } from "@/modules/types";

export const ProjectNextMaintenanceBadge = ({
  record,
}: {
  record: LbsDeal;
}) => {
  const { data: milestones = [] } = useGetList<DealMilestone>(
    "deal_milestones",
    {
      filter: { "deal_id@eq": record.id },
      pagination: { page: 1, perPage: 50 },
      sort: { field: "due_date", order: "ASC" },
    },
    { staleTime: 30_000, enabled: !!record.id },
  );

  const nextReviewDate = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10);
    const reviewMilestones = milestones
      .filter(
        (milestone) =>
          milestone.title === MAINTENANCE_REVIEW_MILESTONE_TITLE &&
          !milestone.completed_at &&
          milestone.due_date,
      )
      .map((milestone) => String(milestone.due_date))
      .filter((date) => date >= today)
      .sort();

    return reviewMilestones[0] ?? null;
  }, [milestones]);

  if (!nextReviewDate) return null;

  return (
    <div className="inline-flex items-center gap-1.5 rounded-md border border-border bg-muted/30 px-2.5 py-1 text-xs text-muted-foreground">
      <CalendarClock className="size-3.5 shrink-0" />
      <span>
        Next review:{" "}
        <span className="font-medium text-foreground">
          {formatMaintenanceReviewLabel(nextReviewDate)}
        </span>
      </span>
    </div>
  );
};
