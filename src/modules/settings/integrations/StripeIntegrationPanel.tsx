import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  CheckCircle2,
  ChevronRight,
  Copy,
  ExternalLink,
  Loader2,
} from "lucide-react";
import { useEffect, useState } from "react";
import { useDataProvider, useNotify } from "ra-core";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { CrmDataProvider } from "@/components/atomic-crm/providers/types";
import { IntegrationFeatureSwitchRow } from "@/modules/settings/integrations/IntegrationFeatureSwitchRow";
import { IntegrationPanelHeader } from "@/modules/settings/integrations/IntegrationPanelHeader";
import type {
  ClientCardPaymentStatus,
  StripeClientSettings,
} from "@/modules/settings/integrations/stripeClientSettings";
import { cn } from "@/lib/utils";

const copyText = async (value: string, notify: ReturnType<typeof useNotify>) => {
  try {
    await navigator.clipboard.writeText(value);
    notify("Copied", { type: "success" });
  } catch {
    notify("Could not copy", { type: "error" });
  }
};

const statusSummary = (status: ClientCardPaymentStatus) => {
  switch (status) {
    case "live":
      return "Clients can pay invoices and proposals by card.";
    case "paused":
      return "Stripe is connected, but card checkout is off. Clients must pay manually.";
    default:
      return "Add Stripe keys to accept card payments.";
  }
};

const headerStatusFor = (
  status: ClientCardPaymentStatus,
): "connected" | "partial" | "off" => {
  switch (status) {
    case "live":
      return "connected";
    case "paused":
      return "partial";
    default:
      return "off";
  }
};

const CredentialStatusRow = ({
  label,
  configured,
  preview,
}: {
  label: string;
  configured: boolean;
  preview?: string | null;
}) => (
  <div className="flex items-start justify-between gap-3 rounded-md border bg-background px-3 py-2 text-xs">
    <div className="min-w-0 space-y-0.5">
      <p className="font-medium text-foreground">{label}</p>
      {preview ? (
        <p className="font-mono text-[11px] text-muted-foreground">{preview}</p>
      ) : null}
    </div>
    <Badge
      variant={configured ? "default" : "secondary"}
      className="shrink-0 gap-1 text-[10px] font-normal"
    >
      {configured ? (
        <>
          <CheckCircle2 className="size-3" />
          Active
        </>
      ) : (
        "Missing"
      )}
    </Badge>
  </div>
);

export const StripeIntegrationPanel = () => {
  const dataProvider = useDataProvider<CrmDataProvider>();
  const notify = useNotify();
  const queryClient = useQueryClient();

  const [publishableKey, setPublishableKey] = useState("");
  const [secretKey, setSecretKey] = useState("");
  const [webhookSecret, setWebhookSecret] = useState("");
  const [editingCredentials, setEditingCredentials] = useState(false);
  const [advancedOpen, setAdvancedOpen] = useState(false);

  const { data, isPending } = useQuery({
    queryKey: ["stripe-client-settings"],
    queryFn: () => dataProvider.getStripeClientSettings(),
  });

  const isEnvironmentSource = data?.credential_source === "environment";
  const isDatabaseSource = data?.credential_source === "database";

  useEffect(() => {
    if (!data) return;
    setPublishableKey(data.stripe_publishable_key ?? "");
    setSecretKey("");
    setWebhookSecret("");
    setEditingCredentials(data.credential_source !== "environment");
  }, [data]);

  const saveMutation = useMutation({
    mutationFn: (payload: Parameters<CrmDataProvider["updateStripeClientSettings"]>[0]) =>
      dataProvider.updateStripeClientSettings(payload),
    onSuccess: (saved) => {
      queryClient.setQueryData(["stripe-client-settings"], saved);
      setSecretKey("");
      setWebhookSecret("");
      setEditingCredentials(saved.credential_source !== "environment");
      notify("Stripe settings saved", { type: "success" });
    },
    onError: (error) => {
      notify(error instanceof Error ? error.message : "Failed to save", {
        type: "error",
      });
    },
  });

  const toggleMutation = useMutation({
    mutationFn: (enabled: boolean) =>
      dataProvider.updateStripeClientSettings({
        client_payments_enabled: enabled,
      }),
    onSuccess: (saved) => {
      queryClient.setQueryData(["stripe-client-settings"], saved);
    },
    onError: (error) => {
      notify(error instanceof Error ? error.message : "Failed to update", {
        type: "error",
      });
    },
  });

  const testMutation = useMutation({
    mutationFn: () => dataProvider.testStripeClientSettings(),
    onSuccess: () => notify("Stripe connection verified", { type: "success" }),
    onError: (error) => {
      notify(error instanceof Error ? error.message : "Connection failed", {
        type: "error",
      });
    },
  });

  if (isPending) {
    return (
      <div className="flex items-center gap-2 py-8 text-sm text-muted-foreground">
        <Loader2 className="size-4 animate-spin" />
        Loading Stripe…
      </div>
    );
  }

  const settings = data as StripeClientSettings | undefined;
  const paymentStatus = settings?.payment_status ?? "not_configured";
  const canAcceptCards = settings?.secret_key_configured === true;

  const handleSave = () => {
    const payload: Parameters<CrmDataProvider["updateStripeClientSettings"]>[0] =
      {};

    if (publishableKey.trim()) {
      payload.stripe_publishable_key = publishableKey.trim();
    } else if (isDatabaseSource) {
      payload.stripe_publishable_key = null;
    }

    if (secretKey.trim()) {
      payload.stripe_secret_key = secretKey.trim();
    }
    if (webhookSecret.trim()) {
      payload.stripe_webhook_secret = webhookSecret.trim();
    }

    if (
      !payload.stripe_publishable_key &&
      !payload.stripe_secret_key &&
      !payload.stripe_webhook_secret
    ) {
      notify("Enter at least one credential to save", { type: "warning" });
      return;
    }

    saveMutation.mutate(payload);
  };

  return (
    <div className="space-y-6">
      <IntegrationPanelHeader
        title="Stripe"
        description="One switch controls card payments for invoices, proposals, and payment links."
        status={headerStatusFor(paymentStatus)}
        badgeLabel={settings?.payment_status_label}
        meta={settings?.publishable_key_preview ?? undefined}
      />

      <div className="space-y-4 rounded-xl border bg-muted/10 p-4">
        <p className="text-sm text-muted-foreground">
          {statusSummary(paymentStatus)}
        </p>

        <IntegrationFeatureSwitchRow
          label="Accept card payments"
          description="On = clients can pay by card. Off = manual payment only."
          checked={settings?.client_payments_enabled === true}
          disabled={!canAcceptCards || toggleMutation.isPending}
          onCheckedChange={(checked) => toggleMutation.mutate(checked)}
        />

        {!canAcceptCards ? (
          <p className="text-xs text-muted-foreground">
            Stripe keys are not on the server yet. Add them in Advanced below,
            or ask your developer to set server secrets in Supabase.
          </p>
        ) : null}

        {paymentStatus === "paused" ? (
          <Alert>
            <AlertDescription>
              Stripe is ready. Turn on <strong>Accept card payments</strong> to
              let clients pay online.
            </AlertDescription>
          </Alert>
        ) : null}
      </div>

      <div className="rounded-xl border bg-muted/20">
        <button
          type="button"
          className="flex w-full items-start gap-3 p-4 text-left"
          onClick={() => setAdvancedOpen((current) => !current)}
          aria-expanded={advancedOpen}
        >
          <ChevronRight
            className={cn(
              "mt-0.5 size-4 shrink-0 text-muted-foreground transition-transform",
              advancedOpen && "rotate-90",
            )}
          />
          <div className="min-w-0 flex-1 space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-sm font-medium">Advanced</h3>
              <Badge variant="secondary" className="text-[10px] font-normal">
                Keys & webhook
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground">
              Connection details, webhook URL, and optional key import.
            </p>
          </div>
        </button>

        {advancedOpen ? (
          <div className="space-y-4 border-t px-4 pb-4 pt-3">
            {isEnvironmentSource ? (
              <p className="text-xs text-muted-foreground">
                Stripe is active via server secrets. Import keys below only if you
                want to manage them from Settings instead.
              </p>
            ) : null}

            <div className="space-y-2">
              <CredentialStatusRow
                label="Publishable key"
                configured={settings?.publishable_key_configured === true}
                preview={settings?.publishable_key_preview}
              />
              <CredentialStatusRow
                label="Secret key"
                configured={settings?.secret_key_configured === true}
                preview={
                  settings?.secret_key_configured
                    ? (settings.connection_label ?? "Configured")
                    : null
                }
              />
              <CredentialStatusRow
                label="Webhook signing secret"
                configured={settings?.webhook_secret_configured === true}
                preview={
                  settings?.webhook_secret_configured ? "Configured" : null
                }
              />
            </div>

            {settings?.webhook_url ? (
              <div className="space-y-2">
                <Label>Webhook endpoint URL</Label>
                <div className="flex gap-2">
                  <Input
                    readOnly
                    value={settings.webhook_url}
                    className="font-mono text-xs"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    onClick={() => void copyText(settings.webhook_url!, notify)}
                    aria-label="Copy webhook URL"
                  >
                    <Copy className="size-4" />
                  </Button>
                  <Button type="button" variant="outline" size="icon" asChild>
                    <a
                      href="https://dashboard.stripe.com/webhooks"
                      target="_blank"
                      rel="noreferrer"
                      aria-label="Open Stripe webhooks"
                    >
                      <ExternalLink className="size-4" />
                    </a>
                  </Button>
                </div>
              </div>
            ) : null}

            {isEnvironmentSource && !editingCredentials ? (
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setEditingCredentials(true)}
                >
                  Import keys to Settings
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  disabled={!canAcceptCards || testMutation.isPending}
                  onClick={() => testMutation.mutate()}
                >
                  Test connection
                </Button>
              </div>
            ) : (
              <div className="space-y-4 rounded-lg border border-dashed p-4">
                <p className="text-xs text-muted-foreground">
                  {isEnvironmentSource
                    ? "Paste keys only to store them in Settings instead of server secrets."
                    : "Leave secret fields blank to keep current values."}
                </p>

                <div className="space-y-2">
                  <Label htmlFor="stripe-publishable-key">Publishable key</Label>
                  <Input
                    id="stripe-publishable-key"
                    value={publishableKey}
                    onChange={(e) => setPublishableKey(e.target.value)}
                    placeholder={
                      settings?.publishable_key_preview
                        ? `Current: ${settings.publishable_key_preview}`
                        : "pk_live_…"
                    }
                    autoComplete="off"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="stripe-secret-key">Secret key</Label>
                  <Input
                    id="stripe-secret-key"
                    type="password"
                    value={secretKey}
                    onChange={(e) => setSecretKey(e.target.value)}
                    placeholder={
                      settings?.secret_key_configured
                        ? "Leave blank to keep current secret"
                        : "sk_live_…"
                    }
                    autoComplete="new-password"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="stripe-webhook-secret">
                    Webhook signing secret
                  </Label>
                  <Input
                    id="stripe-webhook-secret"
                    type="password"
                    value={webhookSecret}
                    onChange={(e) => setWebhookSecret(e.target.value)}
                    placeholder={
                      settings?.webhook_secret_configured
                        ? "Leave blank to keep current webhook secret"
                        : "whsec_…"
                    }
                    autoComplete="new-password"
                  />
                </div>

                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    disabled={saveMutation.isPending}
                    onClick={handleSave}
                  >
                    {saveMutation.isPending ? (
                      <Loader2 className="mr-2 size-4 animate-spin" />
                    ) : null}
                    {isEnvironmentSource ? "Import keys" : "Save keys"}
                  </Button>
                  {isEnvironmentSource ? (
                    <Button
                      type="button"
                      variant="ghost"
                      onClick={() => {
                        setEditingCredentials(false);
                        setPublishableKey("");
                        setSecretKey("");
                        setWebhookSecret("");
                      }}
                    >
                      Cancel
                    </Button>
                  ) : null}
                  <Button
                    type="button"
                    variant="outline"
                    disabled={!canAcceptCards || testMutation.isPending}
                    onClick={() => testMutation.mutate()}
                  >
                    Test connection
                  </Button>
                </div>
              </div>
            )}
          </div>
        ) : null}
      </div>
    </div>
  );
};
