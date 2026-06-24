import { cn } from "@/lib/utils";
import {
  getSmsDeliveryDisplay,
  smsDeliveryToneClassName,
} from "@/modules/messages/smsDeliveryStatus";
import type { ConversationMessage } from "@/modules/types";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

export const SmsDeliveryBadge = ({
  message,
  compact = false,
  className,
}: {
  message: ConversationMessage;
  compact?: boolean;
  className?: string;
}) => {
  const display = getSmsDeliveryDisplay(message);
  if (!display) return null;

  const label = (
    <span
      className={cn(
        "font-medium",
        compact ? "text-[9px]" : "text-[10px]",
        smsDeliveryToneClassName(display.tone),
        className,
      )}
    >
      {display.label}
    </span>
  );

  if (!display.detail) {
    return label;
  }

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
