import type { ReactNode } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type IntegrationStatus = "connected" | "partial" | "off";

const STATUS_LABEL: Record<IntegrationStatus, string> = {
  connected: "Connected",
  partial: "Setup needed",
  off: "Not connected",
};

type Props = {
  name: string;
  subtitle?: string;
  status: IntegrationStatus;
  toggles?: ReactNode;
  onConnect?: () => void;
  onEdit?: () => void;
  onTest?: () => void;
  onRemove?: () => void;
  testDisabled?: boolean;
  removeDisabled?: boolean;
  className?: string;
};

export const IntegrationListRow = ({
  name,
  subtitle,
  status,
  toggles,
  onConnect,
  onEdit,
  onTest,
  onRemove,
  testDisabled,
  removeDisabled,
  className,
}: Props) => {
  const connected = status === "connected" || status === "partial";

  return (
    <div
      className={cn(
        "flex flex-col gap-3 py-4 lg:flex-row lg:items-center lg:justify-between",
        className,
      )}
    >
      <div className="min-w-0 flex-1 space-y-0.5">
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-sm font-medium">{name}</p>
          <Badge
            variant={status === "connected" ? "default" : "secondary"}
            className="text-[10px] font-normal"
          >
            {STATUS_LABEL[status]}
          </Badge>
        </div>
        {subtitle ? (
          <p className="truncate text-xs text-muted-foreground">{subtitle}</p>
        ) : null}
      </div>

      {toggles ? (
        <div className="flex flex-wrap items-center gap-4">{toggles}</div>
      ) : null}

      <div className="flex shrink-0 flex-wrap gap-1">
        {connected ? (
          <>
            {onEdit ? (
              <Button type="button" variant="ghost" size="sm" onClick={onEdit}>
                Edit
              </Button>
            ) : null}
            {onTest ? (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={onTest}
                disabled={testDisabled}
              >
                Test
              </Button>
            ) : null}
            {onRemove ? (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="text-destructive hover:text-destructive"
                onClick={onRemove}
                disabled={removeDisabled}
              >
                Remove
              </Button>
            ) : null}
          </>
        ) : onConnect ? (
          <Button type="button" size="sm" onClick={onConnect}>
            Connect
          </Button>
        ) : null}
      </div>
    </div>
  );
};

export const IntegrationFeatureToggle = ({
  label,
  checked,
  disabled,
  onCheckedChange,
}: {
  label: string;
  checked: boolean;
  disabled?: boolean;
  onCheckedChange: (checked: boolean) => void;
}) => (
  <label
    className={cn(
      "flex cursor-pointer items-center gap-2 text-xs",
      disabled && "cursor-not-allowed opacity-50",
    )}
  >
    <input
      type="checkbox"
      className="size-3.5 rounded border-input accent-primary"
      checked={checked}
      disabled={disabled}
      onChange={(event) => onCheckedChange(event.target.checked)}
    />
    <span className="font-medium">{label}</span>
  </label>
);
