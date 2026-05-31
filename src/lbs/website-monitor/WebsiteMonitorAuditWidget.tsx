import { Link } from "react-router";
import { useGetList, type Identifier } from "ra-core";
import { FileSearch, Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { useWebsiteAudit } from "@/lbs/website-monitor/audit/useWebsiteAudit";
import { deltaVsPreviousDone } from "@/lbs/website-monitor/audit/websiteAuditQueries";
import {
  formatCheckedAt,
} from "@/lbs/website-monitor/websiteMonitorUtils";
import type { MonitoredWebsite } from "@/lbs/website-monitor/types";
import { getWebMonitorShowPath } from "@/lbs/routing";
import { cn } from "@/lib/utils";

const scoreTone = (score: number) => {
  if (score >= 80) return "text-emerald-600";
  if (score >= 50) return "text-amber-600";
  return "text-red-600";
};

const formatDelta = (delta: number | null) => {
  if (delta == null) return null;
  if (delta === 0) return "0";
  return delta > 0 ? `+${delta}` : `${delta}`;
};

export const WebsiteMonitorAuditWidget = ({
  companyId,
  dealId,
  title = "Web Report",
  variant = "card",
}: {
  companyId?: Identifier | null;
  dealId?: Identifier | null;
  title?: string;
  variant?: "card" | "plain";
}) => {
  const filter: Record<string, unknown> = { is_enabled: true };
  if (companyId != null) filter["company_id@eq"] = companyId;
  if (dealId != null) filter["deal_id@eq"] = dealId;

  const enabled = companyId != null || dealId != null;

  const { data: sites = [], isPending } = useGetList<MonitoredWebsite>(
    "monitored_websites",
    {
      filter,
      pagination: { page: 1, perPage: 5 },
      sort: { field: "last_checked_at", order: "DESC" },
    },
    { enabled },
  );

  if (!enabled) return null;

  const isPlain = variant === "plain";

  if (isPending) {
    return (
      <div
        className={
          isPlain
            ? "text-sm text-muted-foreground"
            : "rounded-lg border p-4 text-sm text-muted-foreground"
        }
      >
        <Loader2 className="mr-2 inline size-4 animate-spin" />
        Cargando Web Report…
      </div>
    );
  }

  if (!sites.length) {
    return null;
  }

  return (
    <div className={isPlain ? "space-y-2" : "rounded-lg border p-4 space-y-3"}>
      {!isPlain ? (
        <div className="flex items-center gap-2 text-sm font-medium">
          <FileSearch className="size-4" />
          {title}
        </div>
      ) : null}
      <div className="space-y-2">
        {sites.map((site) => (
          <AuditSiteRow key={site.id} site={site} variant={variant} />
        ))}
      </div>
    </div>
  );
};

const AuditSiteRow = ({
  site,
  variant = "card",
}: {
  site: MonitoredWebsite;
  variant?: "card" | "plain";
}) => {
  const { history, historyPending } = useWebsiteAudit(site.id);
  const isPlain = variant === "plain";

  const latestDoneIndex = history.findIndex((row) => row.status === "done");
  const latestDone =
    latestDoneIndex >= 0 ? history[latestDoneIndex] : null;
  const delta =
    latestDoneIndex >= 0
      ? deltaVsPreviousDone(history, latestDoneIndex)
      : null;
  const deltaText = formatDelta(delta);
  const active = history.find(
    (row) => row.status === "queued" || row.status === "running",
  );

  return (
    <div
      className={
        isPlain
          ? "flex items-center gap-3 py-1"
          : "flex items-center gap-3 rounded-md border border-border/60 px-3 py-2"
      }
    >
      <div className="min-w-0 flex-1">
        <Link
          to={`${getWebMonitorShowPath(site.id)}?tab=report`}
          className="block truncate text-sm font-medium hover:underline"
        >
          {site.display_name || site.company_name || site.url}
        </Link>
        {historyPending ? (
          <p className="text-xs text-muted-foreground">Cargando…</p>
        ) : latestDone ? (
          <p className="text-xs text-muted-foreground">
            Último reporte · {formatCheckedAt(latestDone.requested_at)}
          </p>
        ) : (
          <p className="text-xs text-muted-foreground">Sin reportes aún</p>
        )}
      </div>

      {active ? (
        <Badge variant="secondary" className="text-[10px]">
          <Loader2 className="mr-1 size-3 animate-spin" />
          En curso
        </Badge>
      ) : latestDone?.overall_score != null ? (
        <div className="text-right">
          <span
            className={cn(
              "text-lg font-semibold tabular-nums",
              scoreTone(latestDone.overall_score),
            )}
          >
            {latestDone.overall_score}
          </span>
          {deltaText != null ? (
            <span
              className={cn(
                "ml-1 text-xs tabular-nums",
                delta != null && delta > 0
                  ? "text-emerald-600"
                  : delta != null && delta < 0
                    ? "text-red-600"
                    : "text-muted-foreground",
              )}
            >
              ({deltaText})
            </span>
          ) : null}
        </div>
      ) : (
        <span className="text-xs text-muted-foreground">—</span>
      )}
    </div>
  );
};
