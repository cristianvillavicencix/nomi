import { CheckCircle2, Copy, ExternalLink } from "lucide-react";
import { useNotify } from "ra-core";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const copyIntegrationText = async (
  value: string,
  notify: ReturnType<typeof useNotify>,
) => {
  try {
    await navigator.clipboard.writeText(value);
    notify("Copied", { type: "success" });
  } catch {
    notify("Could not copy", { type: "error" });
  }
};

export const IntegrationSummaryRow = ({
  label,
  value,
  ok,
  mono = true,
}: {
  label: string;
  value: string;
  ok: boolean;
  mono?: boolean;
}) => (
  <div className="flex items-center justify-between gap-3 rounded-md border bg-background px-3 py-2 text-xs">
    <div className="min-w-0">
      <p className="font-medium text-foreground">{label}</p>
      <p
        className={`truncate text-[11px] text-muted-foreground ${mono ? "font-mono" : ""}`}
      >
        {value}
      </p>
    </div>
    <Badge
      variant={ok ? "default" : "secondary"}
      className="shrink-0 gap-1 text-[10px] font-normal"
    >
      {ok ? (
        <>
          <CheckCircle2 className="size-3" />
          OK
        </>
      ) : (
        "Pending"
      )}
    </Badge>
  </div>
);

export const IntegrationCopyField = ({
  label,
  value,
  description,
  onCopy,
  externalHref,
  externalLabel,
}: {
  label: string;
  value: string;
  description?: string;
  onCopy: (value: string) => void;
  externalHref?: string;
  externalLabel?: string;
}) => {
  if (!value) return null;
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      {description ? (
        <p className="text-xs text-muted-foreground">{description}</p>
      ) : null}
      <div className="flex gap-2">
        <Input readOnly value={value} className="font-mono text-xs" />
        <Button
          type="button"
          variant="outline"
          size="icon"
          onClick={() => onCopy(value)}
          aria-label={`Copy ${label}`}
        >
          <Copy className="size-4" />
        </Button>
        {externalHref ? (
          <Button type="button" variant="outline" size="icon" asChild>
            <a
              href={externalHref}
              target="_blank"
              rel="noreferrer"
              aria-label={externalLabel ?? "Open external link"}
            >
              <ExternalLink className="size-4" />
            </a>
          </Button>
        ) : null}
      </div>
    </div>
  );
};
