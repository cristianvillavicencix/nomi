import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, Copy, ExternalLink, HelpCircle, Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
import { useDataProvider, useNotify } from "ra-core";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import type { CrmDataProvider } from "@/components/atomic-crm/providers/types";
import { IntegrationFeatureSwitchRow } from "@/modules/settings/integrations/IntegrationFeatureSwitchRow";
import { IntegrationPanelHeader } from "@/modules/settings/integrations/IntegrationPanelHeader";
import type {
  ClientCardPaymentStatus,
  StripeChannelKey,
  StripeClientSettings,
  StripeCredentialMode,
} from "@/modules/settings/integrations/stripeClientSettings";
import { cn } from "@/lib/utils";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

const copyText = async (value: string, notify: ReturnType<typeof useNotify>) => {
  try {
    await navigator.clipboard.writeText(value);
    notify("Copied", { type: "success" });
  } catch {
    notify("Could not copy", { type: "error" });
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

const SummaryRow = ({
  label,
  value,
  ok,
}: {
  label: string;
  value: string;
  ok: boolean;
}) => (
  <div className="flex items-center justify-between gap-3 rounded-md border bg-background px-3 py-2 text-xs">
    <div>
      <p className="font-medium text-foreground">{label}</p>
      <p className="text-[11px] text-muted-foreground">{value}</p>
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
        "Missing"
      )}
    </Badge>
  </div>
);

const ChannelToggles = ({
  settings,
  keysReady,
  isServerMode,
  pending,
  onToggle,
}: {
  settings: StripeClientSettings;
  keysReady: boolean;
  isServerMode: boolean;
  pending: boolean;
  onToggle: (key: StripeChannelKey, checked: boolean) => void;
}) => {
  const channels: Array<{
    key: StripeChannelKey;
    label: string;
    description: string;
    enabled: boolean;
    requiresStripe?: boolean;
  }> = [
    {
      key: "invoice_payments_enabled",
      label: "Invoices & payment links",
      description:
        "Public invoice checkout and short pay links (SMS/email). One switch controls both.",
      enabled: settings.invoice_payments_enabled,
      requiresStripe: true,
    },
    {
      key: "proposal_payments_enabled",
      label: "Proposal deposits",
      description: "Deposit checkout on signed proposals.",
      enabled: settings.proposal_payments_enabled,
      requiresStripe: true,
    },
    {
      key: "save_cards_default",
      label: "Save cards for future charges",
      description:
        "Default for new invoices: store the client's card for remainder payments and staff charges.",
      enabled: settings.save_cards_default,
      requiresStripe: false,
    },
  ];

  return (
    <div className="space-y-2">
      <p className="text-sm font-medium text-foreground">What Stripe controls</p>
      <p className="text-xs text-muted-foreground">
        Mail sets the sender address. Here you control card payments and saved
        cards.
      </p>
      {channels.map((channel) => {
        const live =
          channel.enabled &&
          (channel.requiresStripe === false || keysReady);
        return (
          <div key={channel.key} className="space-y-1">
            <IntegrationFeatureSwitchRow
              label={channel.label}
              description={
                live
                  ? `Live — ${channel.description}`
                  : channel.description
              }
              checked={channel.enabled}
              disabled={pending}
              onCheckedChange={(checked) => onToggle(channel.key, checked)}
            />
            {live ? (
              <p className="px-1 text-[11px] font-medium text-emerald-700 dark:text-emerald-400">
                {channel.requiresStripe
                  ? `Active via ${isServerMode ? "Supabase server" : "Manual keys"}`
                  : "Default on for new invoices"}
              </p>
            ) : channel.enabled && channel.requiresStripe && !keysReady ? (
              <p className="px-1 text-[11px] text-amber-700 dark:text-amber-300">
                Enabled in settings — waiting for Stripe keys
              </p>
            ) : null}
          </div>
        );
      })}
    </div>
  );
};

const WebhookBlock = ({
  webhookUrl,
  configured,
  onCopy,
}: {
  webhookUrl: string | null;
  configured: boolean;
  onCopy: (value: string) => void;
}) => {
  if (!webhookUrl) return null;
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <Label>Webhook endpoint (Stripe Dashboard)</Label>
        <Badge variant={configured ? "default" : "secondary"} className="text-[10px] font-normal">
          {configured ? "Signing secret OK" : "Add whsec_…"}
        </Badge>
      </div>
      <p className="text-xs text-muted-foreground">
        In Stripe → Developers → Webhooks, add this URL and paste the signing
        secret below (Manual) or in Supabase secrets (Server).
      </p>
      <div className="flex gap-2">
        <Input readOnly value={webhookUrl} className="font-mono text-xs" />
        <Button
          type="button"
          variant="outline"
          size="icon"
          onClick={() => onCopy(webhookUrl)}
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
  );
};

export const StripeIntegrationPanel = () => {
  const dataProvider = useDataProvider<CrmDataProvider>();
  const notify = useNotify();
  const queryClient = useQueryClient();

  const [publishableKey, setPublishableKey] = useState("");
  const [secretKey, setSecretKey] = useState("");
  const [webhookSecret, setWebhookSecret] = useState("");

  const { data, isPending } = useQuery({
    queryKey: ["stripe-client-settings"],
    queryFn: () => dataProvider.getStripeClientSettings(),
  });

  const credentialMode = data?.stripe_credential_mode ?? "server";
  const isServerMode = credentialMode === "server";

  useEffect(() => {
    if (!data) return;
    setPublishableKey(data.stripe_publishable_key ?? "");
    setSecretKey("");
    setWebhookSecret("");
  }, [data]);

  const saveMutation = useMutation({
    mutationFn: (payload: Parameters<CrmDataProvider["updateStripeClientSettings"]>[0]) =>
      dataProvider.updateStripeClientSettings(payload),
    onSuccess: (saved) => {
      queryClient.setQueryData(["stripe-client-settings"], saved);
      setSecretKey("");
      setWebhookSecret("");
      notify("Stripe keys saved", { type: "success" });
    },
    onError: (error) => {
      notify(error instanceof Error ? error.message : "Failed to save", {
        type: "error",
      });
    },
  });

  const updateMutation = useMutation({
    mutationFn: (payload: Parameters<CrmDataProvider["updateStripeClientSettings"]>[0]) =>
      dataProvider.updateStripeClientSettings(payload),
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

  const settings = data as StripeClientSettings;
  const paymentStatus = settings.payment_status ?? "not_configured";
  const keysReady = isServerMode
    ? settings.server_keys_configured === true
    : settings.settings_keys_configured === true;

  const handleCredentialModeChange = (mode: StripeCredentialMode) => {
    updateMutation.mutate({ stripe_credential_mode: mode });
  };

  const handleChannelToggle = (key: StripeChannelKey, checked: boolean) => {
    updateMutation.mutate({ [key]: checked });
  };

  const handleSaveKeys = () => {
    const payload: Parameters<CrmDataProvider["updateStripeClientSettings"]>[0] =
      {};
    if (publishableKey.trim()) payload.stripe_publishable_key = publishableKey.trim();
    if (secretKey.trim()) payload.stripe_secret_key = secretKey.trim();
    if (webhookSecret.trim()) payload.stripe_webhook_secret = webhookSecret.trim();
    if (!payload.stripe_publishable_key && !payload.stripe_secret_key && !payload.stripe_webhook_secret) {
      notify("Enter at least one key to save", { type: "warning" });
      return;
    }
    saveMutation.mutate(payload);
  };

  const serverSecrets = [
    { name: "STRIPE_SECRET_KEY", hint: "sk_live_… or sk_test_…" },
    { name: "STRIPE_PUBLISHABLE_KEY", hint: "pk_live_… (optional if set on Vite build)" },
    { name: "STRIPE_CLIENT_WEBHOOK_SECRET", hint: "whsec_… from Stripe webhook" },
  ];

  return (
    <TooltipProvider>
    <div className="space-y-6">
      <IntegrationPanelHeader
        title="Stripe"
        description="Supabase server for production today, or Manual when you want to paste keys in the CRM."
        status={headerStatusFor(paymentStatus)}
        badgeLabel={settings.payment_status_label}
        meta={settings.publishable_key_preview ?? undefined}
      />

      <RadioGroup
        value={credentialMode}
        onValueChange={(value) =>
          handleCredentialModeChange(value as StripeCredentialMode)
        }
        className="grid gap-2 sm:grid-cols-2"
        disabled={updateMutation.isPending}
      >
        <label
          htmlFor="stripe-mode-server"
          className={cn(
            "flex cursor-pointer gap-3 rounded-lg border p-3",
            isServerMode ? "border-primary bg-primary/5 ring-1 ring-primary/20" : "bg-muted/10",
          )}
        >
          <RadioGroupItem id="stripe-mode-server" value="server" className="mt-0.5" />
          <div>
            <p className="text-sm font-medium">Supabase server</p>
            <p className="text-xs text-muted-foreground">Keys in Edge Function secrets</p>
          </div>
        </label>
        <label
          htmlFor="stripe-mode-settings"
          className={cn(
            "flex cursor-pointer gap-3 rounded-lg border p-3",
            !isServerMode ? "border-primary bg-primary/5 ring-1 ring-primary/20" : "bg-muted/10",
          )}
        >
          <RadioGroupItem id="stripe-mode-settings" value="settings" className="mt-0.5" />
          <div>
          <div className="flex items-center gap-1.5">
            <p className="text-sm font-medium">Manual (Settings)</p>
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  className="text-muted-foreground hover:text-foreground"
                  aria-label="About Manual mode"
                >
                  <HelpCircle className="size-3.5" />
                </button>
              </TooltipTrigger>
              <TooltipContent side="top" className="max-w-xs text-xs">
                Manual keys do not affect Supabase server until you save keys
                here and keep this mode selected. Switch back to Supabase server
                to use server secrets again.
              </TooltipContent>
            </Tooltip>
          </div>
          <p className="text-xs text-muted-foreground">Paste keys in this screen</p>
          </div>
        </label>
      </RadioGroup>

      {isServerMode ? (
        <section className="space-y-4 rounded-xl border bg-muted/10 p-4">
          <div className="space-y-1">
            <h3 className="text-sm font-semibold text-foreground">Supabase server</h3>
            <p className="text-xs text-muted-foreground">
              Detected from Edge Function secrets. No paste required when keys are
              already on the server.
            </p>
          </div>

          <div className="space-y-2">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Connection summary
            </p>
            <SummaryRow
              label="Secret key"
              value={settings.server_keys_configured ? "STRIPE_SECRET_KEY on server" : "Not detected"}
              ok={settings.server_keys_configured}
            />
            <SummaryRow
              label="Publishable key"
              value={settings.publishable_key_preview ?? "From server or VITE_STRIPE_PUBLISHABLE_KEY"}
              ok={settings.publishable_key_configured}
            />
            <SummaryRow
              label="Webhook signing secret"
              value={settings.webhook_secret_configured ? "Configured" : "STRIPE_CLIENT_WEBHOOK_SECRET"}
              ok={settings.webhook_secret_configured}
            />
          </div>

          {!settings.server_keys_configured ? (
            <Alert>
              <AlertDescription>
                <p className="font-medium">Required Supabase secrets</p>
                <ul className="mt-2 list-disc space-y-1 pl-4 text-xs">
                  {serverSecrets.map((row) => (
                    <li key={row.name}>
                      <code className="rounded bg-muted px-1">{row.name}</code> — {row.hint}
                    </li>
                  ))}
                </ul>
              </AlertDescription>
            </Alert>
          ) : null}

          <ChannelToggles
            settings={settings}
            keysReady={keysReady}
            isServerMode
            pending={updateMutation.isPending}
            onToggle={handleChannelToggle}
          />

          <WebhookBlock
            webhookUrl={settings.webhook_url}
            configured={settings.webhook_secret_configured}
            onCopy={(v) => void copyText(v, notify)}
          />

          <Button
            type="button"
            variant="outline"
            disabled={!keysReady || testMutation.isPending}
            onClick={() => testMutation.mutate()}
          >
            Test connection
          </Button>
        </section>
      ) : (
        <section className="space-y-4 rounded-xl border bg-muted/10 p-4">
          <div className="space-y-1">
            <h3 className="text-sm font-semibold text-foreground">Manual (Settings)</h3>
            <p className="text-xs text-muted-foreground">
              Paste keys from Stripe Dashboard. Does not change Supabase server
              secrets until you save keys and stay on Manual.
            </p>
          </div>

          <Alert>
            <AlertDescription className="text-xs">
              Keys saved here are only used while <strong>Manual</strong> is
              selected. Production can keep using Supabase server — switch modes
              anytime.
            </AlertDescription>
          </Alert>

          <div className="space-y-4 rounded-lg border border-dashed bg-background p-4">
            <div className="space-y-2">
              <Label htmlFor="stripe-publishable-key">Publishable key</Label>
              <p className="text-[11px] text-muted-foreground">
                Stripe Dashboard → Developers → API keys →{" "}
                <code className="rounded bg-muted px-1">pk_live_…</code>
              </p>
              <Input
                id="stripe-publishable-key"
                value={publishableKey}
                onChange={(e) => setPublishableKey(e.target.value)}
                placeholder={
                  settings.publishable_key_preview
                    ? `Current: ${settings.publishable_key_preview}`
                    : "pk_live_…"
                }
                autoComplete="off"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="stripe-secret-key">Secret key</Label>
              <p className="text-[11px] text-muted-foreground">
                Same page — Reveal live key →{" "}
                <code className="rounded bg-muted px-1">sk_live_…</code>
              </p>
              <Input
                id="stripe-secret-key"
                type="password"
                value={secretKey}
                onChange={(e) => setSecretKey(e.target.value)}
                placeholder={
                  settings.settings_keys_configured
                    ? "Leave blank to keep current secret"
                    : "sk_live_…"
                }
                autoComplete="new-password"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="stripe-webhook-secret">Webhook signing secret</Label>
              <p className="text-[11px] text-muted-foreground">
                After adding the webhook URL below in Stripe →{" "}
                <code className="rounded bg-muted px-1">whsec_…</code>
              </p>
              <Input
                id="stripe-webhook-secret"
                type="password"
                value={webhookSecret}
                onChange={(e) => setWebhookSecret(e.target.value)}
                placeholder={
                  settings.webhook_secret_configured
                    ? "Leave blank to keep current webhook secret"
                    : "whsec_…"
                }
                autoComplete="new-password"
              />
            </div>

            <Button type="button" disabled={saveMutation.isPending} onClick={handleSaveKeys}>
              {saveMutation.isPending ? (
                <Loader2 className="mr-2 size-4 animate-spin" />
              ) : null}
              Save keys
            </Button>
          </div>

          <ChannelToggles
            settings={settings}
            keysReady={keysReady}
            isServerMode={false}
            pending={updateMutation.isPending}
            onToggle={handleChannelToggle}
          />

          <WebhookBlock
            webhookUrl={settings.webhook_url}
            configured={settings.webhook_secret_configured}
            onCopy={(v) => void copyText(v, notify)}
          />

          <Button
            type="button"
            variant="outline"
            disabled={!keysReady || testMutation.isPending}
            onClick={() => testMutation.mutate()}
          >
            Test connection
          </Button>
        </section>
      )}
    </div>
    </TooltipProvider>
  );
};
