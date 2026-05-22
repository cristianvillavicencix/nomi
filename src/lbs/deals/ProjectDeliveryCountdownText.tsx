import type { Deal } from "@/components/atomic-crm/types";
import {
  getProjectDeliveryCountdown,
  getProjectDeliveryDate,
  getProjectDeliveryUrgency,
  getProjectDeliveryUrgencyClassName,
} from "@/lbs/deals/projectDeliveryDate";
import { cn } from "@/lib/utils";

export const ProjectDeliveryCountdownText = ({
  record,
  className,
}: {
  record: Pick<Deal, "expected_end_date" | "expected_closing_date" | "stage" | "actual_completion_date">;
  className?: string;
}) => {
  const deliveryDate = getProjectDeliveryDate(record);
  const urgency = getProjectDeliveryUrgency(deliveryDate, { stage: record.stage });
  const countdown = getProjectDeliveryCountdown(deliveryDate, {
    stage: record.stage,
    actualCompletionDate: record.actual_completion_date,
  });

  if (!countdown) {
    return <span className={cn("text-muted-foreground", className)}>—</span>;
  }

  return (
    <span className={cn(getProjectDeliveryUrgencyClassName(urgency), className)}>
      {countdown.label}
    </span>
  );
};
