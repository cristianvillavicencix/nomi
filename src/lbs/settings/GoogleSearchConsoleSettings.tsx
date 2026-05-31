import { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useDataProvider, useGetIdentity, useNotify } from "ra-core";
import { ExternalLink, Loader2, Unplug } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type { CrmDataProvider } from "@/components/atomic-crm/providers/types";
import type { GoogleGscStatus } from "@/lbs/website-monitor/googleSearchConsoleTypes";
import { formatCheckedAt } from "@/lbs/website-monitor/websiteMonitorUtils";

export const GoogleSearchConsoleSettings = () => {
  const notify = useNotify();
  const queryClient = useQueryClient();
  const dataProvider = useDataProvider<CrmDataProvider>();
  const [searchParams, setSearchParams] = useSearchParams();
  const { identity } = useGetIdentity();
  const isAdmin =
    (identity as { administrator?: boolean } | undefined)?.administrator ===
    true;

  const [banner, setBanner] = useState<{
    tone: "success" | "error";
    message: string;
  } | null>(null);

  const { data: status, isPending, refetch } = useQuery({
    queryKey: ["google-gsc-status"],
    queryFn: () => dataProvider.googleGscStatus(),
    enabled: isAdmin,
    staleTime: 30_000,
  });

  useEffect(() => {
    const connected = searchParams.get("gsc_connected");
    const error = searchParams.get("gsc_error");
    if (!connected && !error) return;

    if (connected === "1") {
      setBanner({
        tone: "success",
        message: "Search Console conectado. Los sitios con propiedad GSC sincronizarán datos.",
      });
      void refetch();
    } else if (error) {
      setBanner({
        tone: "error",
        message: `Conexión fallida: ${error}`,
      });
    }

    const next = new URLSearchParams(searchParams);
    next.delete("gsc_connected");
    next.delete("gsc_error");
    setSearchParams(next, { replace: true });
  }, [searchParams, setSearchParams, refetch]);

  const connectMutation = useMutation({
    mutationFn: async () => {
      const redirectAfter = `${window.location.origin}/settings?tab=web-monitor`;
      return dataProvider.googleGscConnect({ redirectAfter });
    },
    onSuccess: (result) => {
      if (result.authorize_url) {
        window.location.assign(result.authorize_url);
      }
    },
    onError: (cause) => {
      notify(
        cause instanceof Error ? cause.message : "No se pudo iniciar OAuth",
        { type: "error" },
      );
    },
  });

  const disconnectMutation = useMutation({
    mutationFn: () => dataProvider.googleGscDisconnect(),
    onSuccess: () => {
      notify("Search Console desconectado", { type: "info" });
      void queryClient.invalidateQueries({ queryKey: ["google-gsc-status"] });
    },
    onError: (cause) => {
      notify(
        cause instanceof Error ? cause.message : "No se pudo desconectar",
        { type: "error" },
      );
    },
  });

  const syncAllMutation = useMutation({
    mutationFn: () => dataProvider.googleGscSync({ syncAll: true }),
    onSuccess: (result) => {
      notify(
        `GSC sincronizado: ${result.synced ?? 0} sitios (${result.skipped ?? 0} omitidos)`,
        { type: "success" },
      );
      void queryClient.invalidateQueries({ queryKey: ["google-gsc-status"] });
      void queryClient.invalidateQueries({ queryKey: ["gsc-snapshot"] });
    },
    onError: (cause) => {
      notify(
        cause instanceof Error ? cause.message : "Sync falló",
        { type: "error" },
      );
    },
  });

  const connected = (status as GoogleGscStatus | undefined)?.connected === true;

  const handleConnect = useCallback(() => {
    connectMutation.mutate();
  }, [connectMutation]);

  if (!isAdmin) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Google Search Console</CardTitle>
        <CardDescription>
          Conecta la cuenta Google de la agencia para clics, impresiones y top
          queries en los Web Reports. Solo sitios con propiedad en GSC tendrán
          datos.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {banner ? (
          <div
            className={
              banner.tone === "success"
                ? "rounded-md border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-800 dark:text-emerald-200"
                : "rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive"
            }
          >
            {banner.message}
          </div>
        ) : null}

        {isPending ? (
          <p className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" />
            Cargando estado…
          </p>
        ) : connected ? (
          <div className="space-y-3">
            <p className="text-sm">
              Conectado como{" "}
              <span className="font-medium">
                {(status as GoogleGscStatus)?.google_email ?? "Google"}
              </span>
              {(status as GoogleGscStatus)?.last_synced_at ? (
                <span className="text-muted-foreground">
                  {" "}
                  · último sync{" "}
                  {formatCheckedAt((status as GoogleGscStatus).last_synced_at)}
                </span>
              ) : null}
            </p>
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={syncAllMutation.isPending}
                onClick={() => syncAllMutation.mutate()}
              >
                {syncAllMutation.isPending ? (
                  <Loader2 className="mr-2 size-4 animate-spin" />
                ) : null}
                Sincronizar todos los sitios
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                disabled={disconnectMutation.isPending}
                onClick={() => disconnectMutation.mutate()}
              >
                {disconnectMutation.isPending ? (
                  <Loader2 className="mr-2 size-4 animate-spin" />
                ) : (
                  <Unplug className="mr-2 size-4" />
                )}
                Desconectar
              </Button>
              <Button type="button" variant="ghost" size="sm" asChild>
                <a
                  href="https://search.google.com/search-console"
                  target="_blank"
                  rel="noreferrer"
                >
                  <ExternalLink className="mr-2 size-4" />
                  Abrir GSC
                </a>
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Requiere OAuth en Google Cloud (Search Console API) y que la cuenta
              tenga acceso a las propiedades de tus clientes.
            </p>
            <Button
              type="button"
              size="sm"
              disabled={connectMutation.isPending}
              onClick={handleConnect}
            >
              {connectMutation.isPending ? (
                <Loader2 className="mr-2 size-4 animate-spin" />
              ) : null}
              Conectar Search Console
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
