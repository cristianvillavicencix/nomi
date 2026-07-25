import { RotateCw } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  getSmsDeliveryDisplay,
  isSmsDeliveryRetryable,
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
  onRetry,
  retrying = false,
}: {
  message: ConversationMessage;
  compact?: boolean;
  className?: string;
  onRetry?: (message: ConversationMessage) => void;
  retrying?: boolean;
}) => {
  const display = getSmsDeliveryDisplay(message);
  if (!display) return null;

  const showRetry = Boolean(onRetry) && isSmsDeliveryRetryable(message);

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

  const statusLabel =
    display.detail && !showRetry ? (
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
    ) : (
      label
    );

  if (!showRetry) {
    return statusLabel;
  }

  return (
    <span className="inline-flex items-center gap-1">
      {display.detail ? (
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
      ) : (
        statusLabel
      )}
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            className="inline-flex items-center rounded-sm border-0 bg-transparent p-0 text-muted-foreground hover:text-foreground disabled:opacity-50"
            aria-label="Resend message"
            disabled={retrying}
            onClick={() => onRetry?.(message)}
          >
            <RotateCw
              className={cn(compact ? "size-2.5" : "size-3", retrying && "animate-spin")}
            />
          </button>
        </TooltipTrigger>
        <TooltipContent side="top">Resend message</TooltipContent>
      </Tooltip>
    </span>
  );
};
