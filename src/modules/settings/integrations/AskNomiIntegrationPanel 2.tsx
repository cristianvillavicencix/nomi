import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ExternalLink, Loader2, Sparkles } from "lucide-react";
import { useNotify } from "ra-core";

import { Button } from "@/components/ui/button";
import {
  invokeEdgeFunction,
  readEdgeFunctionErrorMessage,
} from "@/components/atomic-crm/providers/supabase/invokeEdgeFunction";
import { IntegrationFeatureSwitchRow } from "@/modules/settings/integrations/IntegrationFeatureSwitchRow";
import { IntegrationPanelHeader } from "@/modules/settings/integrations/IntegrationPanelHeader";
import type { IntegrationStatus } from "@/modules/settings/integrations/IntegrationListRow";

export type AskNomiIntegrationStatus = {
  enabled: boolean;
  anthropic_configured: boolean;
  model: string;
  ready: boolean;
};

const ASK_NOMI_STATUS_QUERY_KEY = ["ask-nomi-integration-status"] as const;

export const AskNomiIntegrationPanel = () => {
  const notify = useNotify();
  const queryClient = useQueryClient();

  const { data, isPending } = useQuery({
    queryKey: ASK_NOMI_STATUS_QUERY_KEY,
    queryFn: async () => {
      const { data: payload, error } =
        await invokeEdgeFunction<AskNomiIntegrationStatus>("crm_assistant", {
          method: "POST",
          body: { action: "status" },
        });
      if (error || !payload) {
        throw new Error(
          await readEdgeFunctionErrorMessage(
            error ?? {},
            "Could not load Ask Sigma status",
          ),
        );
      }
      return payload;
    },
    staleTime: 30_000,
  });

  const saveMutation = useMutation({
    mutationFn: async (enabled: boolean) => {
      const { data: payload, error } =
        await invokeEdgeFunction<AskNomiIntegrationStatus>("crm_assistant", {
          method: "POST",
          body: { action: "update_settings", enabled },
        });
      if (error || !payload) {
        throw new Error(
          await readEdgeFunctionErrorMessage(
            error ?? {},
            "Could not save Ask Sigma settings",
          ),
        );
      }
      return payload;
    },
    onSuccess: (payload) => {
      queryClient.setQueryData(ASK_NOMI_STATUS_QUERY_KEY, payload);
      void queryClient.invalidateQueries({
        queryKey: ["organization-assistant-settings"],
      });
      notify(
        payload.enabled ? "Ask Sigma enabled" : "Ask Sigma disabled",
        { type: "success" },
      );
    },
    onError: async (error) => {
      notify(
        error instanceof Error ? error.message : "Could not save settings",
        { type: "error" },
      );
    },
  });

  if (isPending && !data) {
    return (
      <div className="flex items-center gap-2 py-8 text-sm text-muted-foreground">
        <Loader2 className="size-4 animate-spin" />
        Loading Ask Sigma…
      </div>
    );
  }

  const enabled = data?.enabled !== false;
  const anthropicConfigured = data?.anthropic_configured === true;
  const model = data?.model ?? "claude-sonnet-4-6";

  let status: IntegrationStatus = "off";
  let badgeLabel = "Off";
  if (enabled && anthropicConfigured) {
    status = "connected";
    badgeLabel = "Ready";
  } else if (enabled && !anthropicConfigured) {
    status = "partial";
    badgeLabel = "Setup needed";
  } else if (!enabled && anthropicConfigured) {
    status = "partial";
    badgeLabel = "Disabled";
  }

  return (
    <div className="space-y-6">
      <IntegrationPanelHeader
        title="Ask Sigma"
        description="Claude-powered CRM assistant for search, navigation, and confirmed actions."
        status={status}
        badgeLabel={badgeLabel}
        meta={anthropicConfigured ? `Model: ${model}` : undefined}
        actions={
          <Button type="button" variant="secondary" size="sm" asChild>
            <a
              href="https://console.anthropic.com/"
              target="_blank"
              rel="noreferrer"
            >
              Anthropic Console
              <ExternalLink className="ml-1.5 size-3.5" />
            </a>
          </Button>
        }
      />

      <IntegrationFeatureSwitchRow
        label="Enable Ask Sigma for this workspace"
        description="Shows the Ask Sigma button in the app shell. Mutations still require confirmation in the chat panel."
        checked={enabled}
        disabled={saveMutation.isPending}
        onCheckedChange={(checked) => saveMutation.mutate(checked)}
      />

      <div className="space-y-3 rounded-lg border bg-muted/20 px-4 py-3 text-sm">
        <div className="flex items-start gap-2">
          <Sparkles className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
          <div className="space-y-2 text-muted-foreground">
            <p>
              Ask Sigma uses the Anthropic Messages API with tool calling. The API
              key is stored as the Edge secret{" "}
              <code className="text-foreground">ANTHROPIC_API_KEY</code>
              {" "}(same secret as website audits). Optional:{" "}
              <code className="text-foreground">ANTHROPIC_MODEL</code>.
            </p>
            <p>
              {anthropicConfigured ? (
                <>
                  Anthropic is configured. Current model:{" "}
                  <span className="font-medium text-foreground">{model}</span>.
                </>
              ) : (
                <>
                  Anthropic is not configured. Set{" "}
                  <code className="text-foreground">ANTHROPIC_API_KEY</code> in
                  Supabase Edge Function secrets, then redeploy{" "}
                  <code className="text-foreground">crm_assistant</code>.
                </>
              )}
            </p>
            <p>
              Staff need the{" "}
              <code className="text-foreground">crm.assistant.use</code>{" "}
              capability (or CRM view permissions). Secrets and Stripe keys are
              never exposed to the assistant.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
