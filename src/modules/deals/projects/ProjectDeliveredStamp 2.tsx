import { cn } from "@/lib/utils";
import type { LbsDeal } from "@/modules/types";

const DELIVERED_STATUSES = new Set(["launched", "completed"]);

export const isProjectDelivered = (record: LbsDeal) =>
  DELIVERED_STATUSES.has(String(record.delivery_status ?? "")) ||
  record.stage === "closed_won" ||
  record.stage === "delivered" ||
  record.stage === "launch";

/**
 * Eye-catching vertical "DELIVERED" stamp pinned to the right edge of the
 * project show page — mirrors the invoice status ribbon pattern.
 */
export const ProjectDeliveredStamp = ({
  record,
  className,
}: {
  record: LbsDeal;
  className?: string;
}) => {
  if (!isProjectDelivered(record)) return null;

  return (
    <div
      aria-hidden
      className={cn(
        "pointer-events-none absolute top-24 right-0 z-20 select-none print:hidden",
        className,
      )}
    >
      <div className="flex items-center gap-2 rounded-l-md border border-r-0 border-success/40 bg-success py-3 pr-1 pl-2 text-success-foreground shadow-md [writing-mode:vertical-rl]">
        <span className="rotate-180 text-[11px] font-bold uppercase tracking-[0.25em]">
          Delivered
        </span>
      </div>
    </div>
  );
};
