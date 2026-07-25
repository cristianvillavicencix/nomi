import { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useDataProvider, useNotify } from "ra-core";
import { Loader2 } from "lucide-react";

import type { CrmDataProvider } from "@/components/atomic-crm/providers/types";
import { IntegrationListRow } from "@/modules/settings/integrations/IntegrationListRow";

export const GoogleGscIntegrationRow = () => {
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
      const redirectAfter = `${window.location.origin}/settings?tab=connectors`;
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
  const subtitle = isPending
    ? "Loading…"
    : connected
      ? status?.google_email || "Connected"
      : "Website monitor search analytics";

  const handleRemove = useCallback(() => {
    if (!window.confirm("Disconnect Google Search Console?")) return;
    disconnectMutation.mutate();
  }, [disconnectMutation]);

  return (
    <div className="space-y-2">
      {banner ? (
        <p className="text-xs text-muted-foreground">{banner}</p>
      ) : null}
      <IntegrationListRow
        name="Google Search Console"
        subtitle={subtitle}
        status={connected ? "connected" : "off"}
        onConnect={() => connectMutation.mutate()}
        onRemove={connected ? handleRemove : undefined}
        removeDisabled={disconnectMutation.isPending}
        toggles={
          connectMutation.isPending ? (
            <Loader2 className="size-4 animate-spin text-muted-foreground" />
          ) : null
        }
      />
    </div>
  );
};
