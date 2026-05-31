import { Info } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { METRIC_TOOLTIPS } from "@/lbs/website-monitor/audit/auditMetricTooltips";

export const MetricInfo = ({
  tooltipKey,
  text,
}: {
  tooltipKey?: keyof typeof METRIC_TOOLTIPS;
  text?: string;
}) => {
  const content =
    text ?? (tooltipKey ? METRIC_TOOLTIPS[tooltipKey] : undefined);
  if (!content) return null;

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          className="inline-flex size-5 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground print:hidden"
          aria-label="Más información"
        >
          <Info className="size-3.5" />
        </button>
      </TooltipTrigger>
      <TooltipContent side="top" className="max-w-xs text-left">
        {content}
      </TooltipContent>
    </Tooltip>
  );
};
