import type { ReactNode } from "react";
import { Badge } from "@/components/ui/badge";
import type { IntegrationStatus } from "@/modules/settings/integrations/IntegrationListRow";

const STATUS_LABEL: Record<IntegrationStatus, string> = {
  connected: "Connected",
  partial: "Setup needed",
  off: "Not connected",
};

type Props = {
  title: string;
  description?: string;
  status: IntegrationStatus;
  meta?: string;
  /** Overrides default Connected / Setup needed / Not connected badge text. */
  badgeLabel?: string;
  actions?: ReactNode;
};

export const IntegrationPanelHeader = ({
  title,
  description,
  status,
  meta,
  badgeLabel,
  actions,
}: Props) => (
  <div className="flex flex-col gap-3 border-b border-border/40 pb-5 sm:flex-row sm:items-start sm:justify-between">
    <div className="min-w-0 space-y-1">
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="text-base font-semibold">{title}</h2>
        <Badge
          variant={status === "connected" ? "default" : "secondary"}
          className="text-[10px] font-normal"
        >
          {badgeLabel ?? STATUS_LABEL[status]}
        </Badge>
      </div>
      {description ? (
        <p className="text-sm text-muted-foreground">{description}</p>
      ) : null}
      {meta ? (
        <p className="font-mono text-xs text-muted-foreground">{meta}</p>
      ) : null}
    </div>
    {actions ? (
      <div className="flex shrink-0 flex-wrap gap-2">{actions}</div>
    ) : null}
  </div>
);
