import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { WebsiteMonitorStatus } from "@/lbs/website-monitor/types";
import {
  WEBSITE_STATUS_COLORS,
  WEBSITE_STATUS_LABELS,
} from "@/lbs/website-monitor/websiteMonitorUtils";

export const WebsiteStatusBadge = ({
  status,
  className,
}: {
  status: WebsiteMonitorStatus;
  className?: string;
}) => (
  <Badge
    variant="outline"
    className={cn("font-mono text-[11px] uppercase tracking-wide", className)}
    style={{
      borderColor: WEBSITE_STATUS_COLORS[status],
      color: WEBSITE_STATUS_COLORS[status],
    }}
  >
    {WEBSITE_STATUS_LABELS[status]}
  </Badge>
);

export const WebsiteStatusDot = ({
  status,
  className,
}: {
  status: WebsiteMonitorStatus;
  className?: string;
}) => (
  <span
    aria-hidden
    className={cn("inline-block size-2.5 rounded-full", className)}
    style={{ backgroundColor: WEBSITE_STATUS_COLORS[status] }}
  />
);
