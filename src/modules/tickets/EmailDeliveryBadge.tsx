import { cn } from "@/lib/utils";
import {
  emailDeliveryToneClassName,
  getTicketEmailDeliveryDisplay,
} from "@/modules/tickets/ticketEmailDeliveryStatus";
import type { TicketMessage } from "@/modules/types";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

export const EmailDeliveryBadge = ({
  message,
  compact = false,
  className,
}: {
  message: TicketMessage;
  compact?: boolean;
  className?: string;
}) => {
  const display = getTicketEmailDeliveryDisplay(message);
  if (!display) return null;

  const label = (
    <span
      className={cn(
        "font-medium",
        compact ? "text-[9px]" : "text-[10px]",
        emailDeliveryToneClassName(display.tone),
        className,
      )}
    >
      {display.label}
    </span>
  );

  if (!display.detail) return label;

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          className="inline-flex cursor-help items-center border-0 bg-transparent p-0"
        >
          {label}
        </button>
      </TooltipTrigger>
      <TooltipContent side="top">{display.detail}</TooltipContent>
    </Tooltip>
  );
};
