import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useDataProvider, useGetIdentity, useNotify } from "ra-core";
import { Loader2, RefreshCw } from "lucide-react";
import type { Identifier } from "ra-core";
import { Button } from "@/components/ui/button";
import {
  WebsiteAuditTableShell,
} from "@/lbs/website-monitor/audit/WebsiteAuditTableShell";
import type { CrmDataProvider } from "@/components/atomic-crm/providers/types";
import type { GscSearchAnalyticsSnapshot } from "@/lbs/website-monitor/googleSearchConsoleTypes";
import { fetchLatestGscSnapshot } from "@/lbs/website-monitor/googleSearchConsoleQueries";
import { formatCheckedAt } from "@/lbs/website-monitor/websiteMonitorUtils";

const pct = (value: number) => `${(value * 100).toFixed(1)}%`;

const QUERY_COLUMNS = [
  "Consulta",
  "Clics",
  "Impresiones",
  "CTR",
  "Posición",
];

const PAGE_COLUMNS = [
  "Página",
  "Clics",
  "Impresiones",
  "CTR",
  "Posición",
];

export const WebsiteAuditGscPanel = ({
  siteId,
}: {
  siteId: Identifier;
}) => {
  const notify = useNotify();
  const queryClient = useQueryClient();
  const dataProvider = useDataProvider<CrmDataProvider>();
  const { identity } = useGetIdentity();
  const isAdmin =
    (identity as { administrator?: boolean } | undefined)?.administrator ===
    true;

  const { data: snapshot, isPending } = useQuery({
    queryKey: ["gsc-snapshot", siteId],
    queryFn: () => fetchLatestGscSnapshot(siteId),
    staleTime: 60_000,
  });

  const syncMutation = useMutation({
    mutationFn: () =>
      dataProvider.googleGscSync({ monitoredWebsiteId: siteId }),
    onSuccess: (result) => {
      if (result.ok && result.reason === "no_matching_gsc_property") {
        notify(
          "Sin propiedad GSC para este dominio. Añádelo en Search Console o verifica acceso.",
          { type: "warning" },
        );
      } else if (result.ok) {
        notify("Datos de Search Console actualizados", { type: "success" });
      } else {
        notify("No se pudo sincronizar Search Console", { type: "warning" });
      }
      void queryClient.invalidateQueries({ queryKey: ["gsc-snapshot", siteId] });
    },
    onError: (cause) => {
      notify(
        cause instanceof Error ? cause.message : "Sync GSC falló",
        { type: "error" },
      );
    },
  });

  if (isPending) {
    return (
      <p className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="size-4 animate-spin" />
        Cargando Search Console…
      </p>
    );
  }

  if (!snapshot) {
    return (
      <div className="rounded-xl border border-dashed border-border/60 px-6 py-8 text-center text-sm">
        <p className="font-medium">Sin datos de Search Console</p>
        <p className="mt-2 text-muted-foreground">
          Conecta GSC en Settings → Web Monitor y asegúrate de que este dominio
          exista como propiedad en la cuenta de la agencia.
        </p>
        {isAdmin ? (
          <Button
            type="button"
            size="sm"
            className="mt-4"
            variant="outline"
            disabled={syncMutation.isPending}
            onClick={() => syncMutation.mutate()}
          >
            {syncMutation.isPending ? (
              <Loader2 className="mr-2 size-4 animate-spin" />
            ) : (
              <RefreshCw className="mr-2 size-4" />
            )}
            Intentar sincronizar
          </Button>
        ) : null}
      </div>
    );
  }

  return (
    <GscSnapshotView
      snapshot={snapshot}
      isAdmin={isAdmin}
      syncing={syncMutation.isPending}
      onSync={() => syncMutation.mutate()}
    />
  );
};

const GscSnapshotView = ({
  snapshot,
  isAdmin,
  syncing,
  onSync,
}: {
  snapshot: GscSearchAnalyticsSnapshot;
  isAdmin: boolean;
  syncing: boolean;
  onSync: () => void;
}) => {
  const { totals } = snapshot;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-sm text-muted-foreground">
            {snapshot.period_start} → {snapshot.period_end} ·{" "}
            {snapshot.site_url}
          </p>
          <p className="text-xs text-muted-foreground">
            Actualizado {formatCheckedAt(snapshot.fetched_at)}
          </p>
        </div>
        {isAdmin ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={syncing}
            onClick={onSync}
          >
            {syncing ? (
              <Loader2 className="mr-2 size-4 animate-spin" />
            ) : (
              <RefreshCw className="mr-2 size-4" />
            )}
            Actualizar GSC
          </Button>
        ) : null}
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard label="Clics" value={totals.clicks.toLocaleString()} />
        <MetricCard
          label="Impresiones"
          value={totals.impressions.toLocaleString()}
        />
        <MetricCard label="CTR" value={pct(totals.ctr)} />
        <MetricCard label="Posición media" value={totals.position.toFixed(1)} />
      </div>

      {snapshot.top_queries.length > 0 ? (
        <WebsiteAuditTableShell columns={QUERY_COLUMNS}>
          {snapshot.top_queries.map((row) => (
            <tr key={row.query} className="border-b border-border/60">
              <td className="py-2 pr-4 font-medium">{row.query}</td>
              <td className="py-2 pr-4 tabular-nums">{row.clicks}</td>
              <td className="py-2 pr-4 tabular-nums">{row.impressions}</td>
              <td className="py-2 pr-4 tabular-nums">{pct(row.ctr)}</td>
              <td className="py-2 tabular-nums">{row.position.toFixed(1)}</td>
            </tr>
          ))}
        </WebsiteAuditTableShell>
      ) : null}

      {snapshot.top_pages.length > 0 ? (
        <div>
          <p className="mb-2 text-sm font-medium">Top páginas</p>
          <WebsiteAuditTableShell columns={PAGE_COLUMNS}>
            {snapshot.top_pages.map((row) => (
              <tr key={row.page} className="border-b border-border/60">
                <td className="max-w-xs truncate py-2 pr-4" title={row.page}>
                  {row.page}
                </td>
                <td className="py-2 pr-4 tabular-nums">{row.clicks}</td>
                <td className="py-2 pr-4 tabular-nums">{row.impressions}</td>
                <td className="py-2 pr-4 tabular-nums">{pct(row.ctr)}</td>
                <td className="py-2 tabular-nums">{row.position.toFixed(1)}</td>
              </tr>
            ))}
          </WebsiteAuditTableShell>
        </div>
      ) : null}
    </div>
  );
};

const MetricCard = ({ label, value }: { label: string; value: string }) => (
  <div className="rounded-xl border border-border/60 bg-card p-4">
    <p className="text-xs font-medium uppercase text-muted-foreground">{label}</p>
    <p className="mt-1 text-2xl font-semibold tabular-nums">{value}</p>
  </div>
);
