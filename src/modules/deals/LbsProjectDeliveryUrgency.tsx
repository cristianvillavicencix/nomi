import { Calendar } from "lucide-react";
import type { Deal } from "@/components/atomic-crm/types";
import {
  formatProjectDeliveryDate,
  getProjectDeliveryCountdown,
  getProjectDeliveryDate,
  getProjectDeliveryUrgency,
  getProjectDeliveryUrgencyClassName,
} from "@/modules/deals/projectDeliveryDate";
import { cn } from "@/lib/utils";

export const LbsProjectDeliveryUrgency = ({ record }: { record: Deal }) => {
  const deliveryDate = getProjectDeliveryDate(record);
  const deliveryDateLabel = formatProjectDeliveryDate(deliveryDate);
  const urgency = getProjectDeliveryUrgency(deliveryDate, {
    stage: record.stage,
  });
  const countdown = getProjectDeliveryCountdown(deliveryDate, {
    stage: record.stage,
    actualCompletionDate: record.actual_completion_date,
  });

  return (
    <div className="flex shrink-0 flex-col gap-0.5 text-right">
      <div className="flex items-center justify-end gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
        <Calendar className="size-3.5 shrink-0" aria-hidden />
        Delivery
      </div>

      {deliveryDateLabel ? (
        <div className="flex flex-wrap items-baseline justify-end gap-x-1.5 gap-y-0.5">
          <span className="text-lg font-bold leading-tight text-foreground">
            {deliveryDateLabel}
          </span>
          {countdown ? (
            <>
              <span className="text-muted-foreground/40" aria-hidden>
                ·
              </span>
              <span
                className={cn(
                  "text-base font-semibold leading-tight",
                  getProjectDeliveryUrgencyClassName(urgency),
                )}
              >
                {countdown.label}
              </span>
            </>
          ) : null}
        </div>
      ) : (
        <p className="text-sm font-medium text-muted-foreground">
          No delivery date set
        </p>
      )}
    </div>
  );
};
