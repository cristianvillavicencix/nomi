import { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { useDataProvider, useNotify } from "ra-core";

import { Button } from "@/components/ui/button";
import type { CrmDataProvider } from "@/components/atomic-crm/providers/types";
import { IntegrationPanelHeader } from "@/modules/settings/integrations/IntegrationPanelHeader";

export const GoogleIntegrationPanel = () => {
  const notify = useNotify();
  const queryClient = useQueryClient();
  const dataProvider = useDataProvider<CrmDataProvider>();
  const [searchParams, setSearchParams] = useSearchParams();
  const [banner, setBanner] = useState<string | null>(null);

  const { data: status, isPending, refetch } = useQuery({
    queryKey: ["google-gsc-status"],
    queryFn: () => dataProvider.googleGscStatus(),
    staleTime: 30_000,
  });

  useEffect(() => {
    const connected = searchParams.get("gsc_connected");
    const error = searchParams.get("gsc_error");
    if (!connected && !error) return;

    if (connected === "1") {
      setBanner("Search Console connected.");
      void refetch();
    } else if (error) {
      setBanner(`Connection failed: ${error}`);
    }

    const next = new URLSearchParams(searchParams);
    next.delete("gsc_connected");
    next.delete("gsc_error");
    setSearchParams(next, { replace: true });
  }, [searchParams, setSearchParams, refetch]);

  const connectMutation = useMutation({
    mutationFn: async () => {
      const redirectAfter = `${window.location.origin}/settings?tab=connectors&section=google`;
      return dataProvider.googleGscConnect({ redirectAfter });
    },
    onSuccess: (result) => {
      if (result.authorize_url) {
        window.location.assign(result.authorize_url);
      }
    },
    onError: (error) => {
      notify(error instanceof Error ? error.message : "Connect failed", {
        type: "error",
      });
    },
  });

  const disconnectMutation = useMutation({
    mutationFn: () => dataProvider.googleGscDisconnect(),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["google-gsc-status"] });
      notify("Search Console disconnected", { type: "success" });
    },
    onError: (error) => {
      notify(error instanceof Error ? error.message : "Disconnect failed", {
        type: "error",
      });
    },
  });

  const connected = status?.connected === true;

  const handleDisconnect = useCallback(() => {
    if (!window.confirm("Disconnect Google Search Console?")) return;
    disconnectMutation.mutate();
  }, [disconnectMutation]);

  if (isPending) {
    return (
      <div className="flex items-center gap-2 py-8 text-sm text-muted-foreground">
        <Loader2 className="size-4 animate-spin" />
        Loading Google…
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <IntegrationPanelHeader
        title="Google Search Console"
        description="Connect Search Console for website monitor analytics and search performance."
        status={connected ? "connected" : "off"}
        meta={connected ? status?.google_email ?? undefined : undefined}
        actions={
          connected ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="text-destructive hover:text-destructive"
              disabled={disconnectMutation.isPending}
              onClick={handleDisconnect}
            >
              Disconnect
            </Button>
          ) : (
            <Button
              type="button"
              size="sm"
              disabled={connectMutation.isPending}
              onClick={() => connectMutation.mutate()}
            >
              {connectMutation.isPending ? (
                <Loader2 className="mr-2 size-4 animate-spin" />
              ) : null}
              Connect
            </Button>
          )
        }
      />

      {banner ? (
        <p className="rounded-lg border bg-muted/30 px-3 py-2 text-sm text-muted-foreground">
          {banner}
        </p>
      ) : null}

      <div className="space-y-2 text-sm text-muted-foreground">
        <p>
          After connecting, open <strong className="text-foreground">Website monitor</strong>{" "}
          to pick a Search Console property and sync metrics.
        </p>
        {!connected ? (
          <p>
            You will be redirected to Google to authorize read-only access to
            your Search Console properties.
          </p>
        ) : null}
      </div>
    </div>
  );
};
