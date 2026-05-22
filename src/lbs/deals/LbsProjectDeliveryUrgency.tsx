import { CalendarClock } from "lucide-react";
import type { Deal } from "@/components/atomic-crm/types";
import {
  formatProjectDeliveryDate,
  getProjectDeliveryCountdown,
  getProjectDeliveryDate,
  getProjectDeliveryUrgency,
  getProjectDeliveryUrgencyClassName,
} from "@/lbs/deals/projectDeliveryDate";
import { cn } from "@/lib/utils";

export const LbsProjectDeliveryUrgency = ({ record }: { record: Deal }) => {
  const deliveryDate = getProjectDeliveryDate(record);
  const deliveryDateLabel = formatProjectDeliveryDate(deliveryDate);
  const urgency = getProjectDeliveryUrgency(deliveryDate, { stage: record.stage });
  const countdown = getProjectDeliveryCountdown(deliveryDate, {
    stage: record.stage,
    actualCompletionDate: record.actual_completion_date,
  });

  return (
    <div className="flex min-w-[220px] max-w-[320px] shrink-0 flex-col gap-1 px-1 py-1 text-right sm:text-left">
      <div className="flex items-center justify-end gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground sm:justify-start">
        <CalendarClock className="size-3.5 shrink-0" />
        Delivery
      </div>

      {deliveryDateLabel ? (
        <div className="flex min-w-0 flex-wrap items-baseline justify-end gap-x-2 gap-y-0.5 sm:justify-start">
          <span className="text-lg font-bold leading-tight text-foreground sm:text-xl">
            {deliveryDateLabel}
          </span>
          {countdown ? (
            <>
              <span className="text-base font-light text-muted-foreground/50">|</span>
              <span
                className={cn(
                  "text-lg font-bold leading-tight sm:text-xl",
                  getProjectDeliveryUrgencyClassName(urgency),
                )}
              >
                {countdown.label}
              </span>
            </>
          ) : null}
        </div>
      ) : (
        <p className="text-sm font-medium text-muted-foreground">No delivery date set</p>
      )}
    </div>
  );
};
