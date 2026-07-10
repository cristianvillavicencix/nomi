import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { HostingerDnsHealth } from "@/modules/hostinger/hostingerDnsHealth";

type Props = {
  health: HostingerDnsHealth | null | undefined;
  className?: string;
  compact?: boolean;
};

const DnsBadge = ({
  label,
  ok,
}: {
  label: string;
  ok: boolean;
}) => (
  <Badge
    variant={ok ? "secondary" : "outline"}
    className={cn(
      "font-mono text-[10px] font-normal uppercase",
      ok ? "text-emerald-700 dark:text-emerald-400" : "text-muted-foreground",
    )}
  >
    {label}
    {!ok ? " —" : ""}
  </Badge>
);

export const HostingerDnsHealthBadges = ({
  health,
  className,
  compact = false,
}: Props) => {
  if (!health) {
    return (
      <span className={cn("text-xs text-muted-foreground", className)}>
        DNS not checked
      </span>
    );
  }

  if (compact) {
    const flags = [
      health.has_a ? "A" : null,
      health.has_mx ? "MX" : null,
      health.ns_hostinger ? "NS" : null,
    ].filter(Boolean);
    if (flags.length === 0) {
      return (
        <span className={cn("text-xs text-muted-foreground", className)}>
          No A/MX/NS
        </span>
      );
    }
    return (
      <span className={cn("font-mono text-xs text-muted-foreground", className)}>
        {flags.join(" · ")}
      </span>
    );
  }

  return (
    <div className={cn("flex flex-wrap gap-1", className)}>
      <DnsBadge label="A" ok={health.has_a} />
      <DnsBadge label="MX" ok={health.has_mx} />
      <DnsBadge label="NS" ok={health.ns_hostinger} />
    </div>
  );
};
