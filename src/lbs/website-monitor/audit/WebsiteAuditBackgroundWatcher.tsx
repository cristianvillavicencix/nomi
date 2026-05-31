import { useQueryClient } from "@tanstack/react-query";
import { ExternalLink, Loader2, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, matchPath, useLocation } from "react-router-dom";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { supabase } from "@/components/atomic-crm/providers/supabase/supabase";
import { isLbsMode } from "@/lbs/productMode";
import { useWebsiteMonitorEnabled } from "@/lbs/settings/useWebsiteMonitorSettings";
import type { WebsiteAudit } from "@/lbs/website-monitor/audit/types";
import { useWebsiteAuditProgress } from "@/lbs/website-monitor/audit/useWebsiteAuditProgress";
import {
  getWebsiteAuditWatches,
  removeWebsiteAuditWatch,
  subscribeWebsiteAuditWatches,
  type WebsiteAuditWatch,
} from "@/lbs/website-monitor/audit/websiteAuditWatchStorage";

const NOTIFIED_KEY = "nomi.website-audit-notified";

const readNotifiedIds = (): number[] => {
  try {
    const raw = sessionStorage.getItem(NOTIFIED_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as number[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

const markNotified = (auditId: number) => {
  const ids = readNotifiedIds();
  if (ids.includes(auditId)) return;
  sessionStorage.setItem(NOTIFIED_KEY, JSON.stringify([...ids, auditId]));
};

const wasNotified = (auditId: number) => readNotifiedIds().includes(auditId);

const showBrowserNotification = (
  title: string,
  body: string,
  url: string,
  tag: string,
) => {
  if (!("Notification" in window) || Notification.permission !== "granted") {
    return;
  }

  const notification = new Notification(title, { body, tag });
  notification.onclick = () => {
    window.focus();
    window.location.assign(url);
    notification.close();
  };
};

const notifyAuditTerminal = (
  watch: WebsiteAuditWatch,
  audit: WebsiteAudit,
  queryClient: ReturnType<typeof useQueryClient>,
) => {
  if (wasNotified(audit.id)) return;
  markNotified(audit.id);

  void queryClient.invalidateQueries({
    queryKey: ["website-audit", watch.siteId],
  });
  void queryClient.invalidateQueries({
    queryKey: ["website-audit-history", watch.siteId],
  });
  void queryClient.invalidateQueries({
    queryKey: ["website-audit-detail", String(audit.id)],
  });

  const reportUrl = `/web-monitor/${watch.siteId}/audit/${audit.id}`;

  if (audit.status === "done") {
    toast.success(`Reporte listo: ${watch.siteLabel}`, {
      description:
        audit.overall_score != null
          ? `Score combinado: ${audit.overall_score}`
          : undefined,
      action: {
        label: "Ver reporte",
        onClick: () => {
          window.location.assign(reportUrl);
        },
      },
      duration: 12_000,
    });

    if (document.hidden) {
      showBrowserNotification(
        "Web Report listo",
        `${watch.siteLabel} — score ${audit.overall_score ?? "—"}`,
        reportUrl,
        `website-audit-${audit.id}`,
      );
    }
  } else if (audit.status === "failed") {
    toast.error(`Reporte fallido: ${watch.siteLabel}`, {
      description: audit.error_message ?? "Revisa el historial del sitio.",
      action: {
        label: "Ver sitio",
        onClick: () => {
          window.location.assign(`/web-monitor/${watch.siteId}/show`);
        },
      },
      duration: 12_000,
    });

    if (document.hidden) {
      showBrowserNotification(
        "Web Report fallido",
        watch.siteLabel,
        `/web-monitor/${watch.siteId}/show`,
        `website-audit-${audit.id}`,
      );
    }
  }

  removeWebsiteAuditWatch(audit.id);
};

const isViewingSiteAudit = (
  pathname: string,
  watch: WebsiteAuditWatch,
  auditId?: number,
) => {
  const showMatch = matchPath(
    { path: "/web-monitor/:siteId/show", end: true },
    pathname,
  );
  if (showMatch?.params.siteId === String(watch.siteId)) {
    return true;
  }

  const auditMatch = matchPath(
    { path: "/web-monitor/:siteId/audit/:auditId", end: true },
    pathname,
  );
  if (
    auditMatch?.params.siteId === String(watch.siteId) &&
    (auditId == null || auditMatch.params.auditId === String(auditId))
  ) {
    return true;
  }

  return false;
};

const AuditWatchBanner = ({
  watch,
  audit,
  onDismiss,
}: {
  watch: WebsiteAuditWatch;
  audit: WebsiteAudit | null;
  onDismiss: () => void;
}) => {
  const progress = useWebsiteAuditProgress(
    audit ?? {
      status: "running",
      requested_at: watch.requestedAt,
    },
  );

  if (!progress) return null;

  return (
    <div className="flex w-full max-w-md flex-col gap-2 rounded-lg border border-border/60 bg-background/95 p-3 shadow-lg backdrop-blur supports-[backdrop-filter]:bg-background/90">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 space-y-0.5">
          <p className="flex items-center gap-2 text-sm font-medium">
            <Loader2 className="size-3.5 shrink-0 animate-spin" />
            <span className="truncate">Reporte en curso</span>
          </p>
          <p className="truncate text-xs text-muted-foreground">{watch.siteLabel}</p>
          <p className="text-xs text-muted-foreground">{progress.phaseLabel}</p>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <Button type="button" size="icon" variant="ghost" className="size-7" asChild>
            <Link to={`/web-monitor/${watch.siteId}/show`}>
              <ExternalLink className="size-3.5" />
              <span className="sr-only">Ver sitio</span>
            </Link>
          </Button>
          <Button
            type="button"
            size="icon"
            variant="ghost"
            className="size-7"
            onClick={onDismiss}
          >
            <X className="size-3.5" />
            <span className="sr-only">Ocultar</span>
          </Button>
        </div>
      </div>
      <Progress value={progress.percent} className="h-1.5" />
    </div>
  );
};

export const WebsiteAuditBackgroundWatcher = () => {
  const queryClient = useQueryClient();
  const location = useLocation();
  const websiteMonitorEnabled = useWebsiteMonitorEnabled();
  const [watches, setWatches] = useState<WebsiteAuditWatch[]>(() =>
    getWebsiteAuditWatches(),
  );
  const [auditById, setAuditById] = useState<Record<number, WebsiteAudit>>({});
  const [dismissedIds, setDismissedIds] = useState<number[]>([]);
  const watchesRef = useRef(watches);
  watchesRef.current = watches;

  const syncWatches = useCallback(() => {
    setWatches(getWebsiteAuditWatches());
  }, []);

  useEffect(() => subscribeWebsiteAuditWatches(syncWatches), [syncWatches]);

  useEffect(() => {
    if (!isLbsMode() || !websiteMonitorEnabled) return;

    let cancelled = false;

    const poll = async () => {
      const activeWatches = watchesRef.current;
      if (activeWatches.length === 0) return;

      const ids = activeWatches.map((watch) => watch.auditId);
      const { data, error } = await supabase
        .from("website_audits")
        .select("*")
        .in("id", ids);

      if (error || cancelled) return;

      const rows = (data ?? []) as WebsiteAudit[];
      const nextById: Record<number, WebsiteAudit> = {};
      for (const row of rows) {
        nextById[row.id] = row;
      }
      setAuditById(nextById);

      for (const watch of activeWatches) {
        const audit = nextById[watch.auditId];
        if (!audit) continue;

        if (audit.status === "done" || audit.status === "failed") {
          notifyAuditTerminal(watch, audit, queryClient);
          syncWatches();
        }
      }
    };

    void poll();
    const timer = window.setInterval(() => void poll(), 3000);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [queryClient, syncWatches, websiteMonitorEnabled, watches.length]);

  const visibleWatches = useMemo(
    () =>
      watches.filter(
        (watch) =>
          !dismissedIds.includes(watch.auditId) &&
          !isViewingSiteAudit(location.pathname, watch, watch.auditId),
      ),
    [dismissedIds, location.pathname, watches],
  );

  if (!isLbsMode() || !websiteMonitorEnabled || visibleWatches.length === 0) {
    return null;
  }

  return (
    <div className="pointer-events-none fixed bottom-20 left-1/2 z-50 flex w-[min(100%-1.5rem,28rem)] -translate-x-1/2 flex-col gap-2 print:hidden max-[768px]:bottom-[calc(5.5rem+env(safe-area-inset-bottom))]">
      {visibleWatches.map((watch) => (
        <div key={watch.auditId} className="pointer-events-auto">
          <AuditWatchBanner
            watch={watch}
            audit={auditById[watch.auditId] ?? null}
            onDismiss={() =>
              setDismissedIds((current) =>
                current.includes(watch.auditId)
                  ? current
                  : [...current, watch.auditId],
              )
            }
          />
        </div>
      ))}
    </div>
  );
};
