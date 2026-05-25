import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Copy, Loader2, Save } from "lucide-react";
import { useDataProvider, useGetIdentity, useNotify } from "ra-core";
import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { CrmDataProvider } from "@/components/atomic-crm/providers/types";
import { DesktopMessageAlertsSection } from "@/lbs/settings/DesktopMessageAlertsSection";
import { WhatsAppSettingsCard } from "@/lbs/settings/communications/WhatsAppSettingsCard";
import { VoiceSettingsCard } from "@/lbs/settings/communications/VoiceSettingsCard";
import { BusinessHoursSettingsCard } from "@/lbs/settings/communications/BusinessHoursSettingsCard";
import { TestSmsButton } from "@/lbs/settings/communications/TestSmsButton";
import { OrganizationSignatureSection } from "@/lbs/settings/OrganizationSignatureSection";
import { FormNotificationsSection } from "@/lbs/settings/FormNotificationsSection";

export const MessagingSettingsSection = () => {
  const dataProvider = useDataProvider<CrmDataProvider>();
  const { identity } = useGetIdentity();
  const notify = useNotify();
  const queryClient = useQueryClient();
  const isAdmin =
    (identity as { administrator?: boolean } | undefined)?.administrator ===
    true;

  const { data, isPending, error } = useQuery({
    queryKey: ["messaging-settings"],
    queryFn: () => dataProvider.getMessagingSettings(),
    enabled: isAdmin,
  });

  const [accountSid, setAccountSid] = useState("");
  const [authToken, setAuthToken] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [smsEnabled, setSmsEnabled] = useState(false);

  useEffect(() => {
    if (!data) return;
    setAccountSid(data.twilio_account_sid ?? "");
    setPhoneNumber(data.twilio_phone_number ?? "");
    setSmsEnabled(data.sms_enabled);
    setAuthToken("");
  }, [data]);

  const saveMutation = useMutation({
    mutationFn: () =>
      dataProvider.updateMessagingSettings({
        twilio_account_sid: accountSid.trim() || null,
        twilio_auth_token: authToken.trim() || null,
        twilio_phone_number: phoneNumber.trim() || null,
        sms_enabled: smsEnabled,
      }),
    onSuccess: (saved) => {
      queryClient.setQueryData(["messaging-settings"], saved);
      setAuthToken("");
      notify("Messaging settings saved", { type: "success" });
    },
    onError: (mutationError) => {
      notify(
        mutationError instanceof Error
          ? mutationError.message
          : "Failed to save messaging settings",
        { type: "error" },
      );
    },
  });

  const businessHoursMutation = useMutation({
    mutationFn: (
      payload: Parameters<CrmDataProvider["updateMessagingSettings"]>[0],
    ) => dataProvider.updateMessagingSettings(payload),
    onSuccess: (saved) => {
      queryClient.setQueryData(["messaging-settings"], saved);
      notify("Business hours saved", { type: "success" });
    },
    onError: (mutationError) => {
      notify(
        mutationError instanceof Error
          ? mutationError.message
          : "Failed to save business hours",
        { type: "error" },
      );
    },
  });

  const webhookUrl = data?.webhook_url ?? "";
  const configuredHint = useMemo(() => {
    if (!data?.has_auth_token) return "Auth token not saved yet.";
    return "Auth token is saved. Leave the token field blank to keep it.";
  }, [data?.has_auth_token]);

  const copyWebhook = async () => {
    if (!webhookUrl) return;
    try {
      await navigator.clipboard.writeText(webhookUrl);
      notify("Webhook URL copied", { type: "info" });
    } catch {
      notify("Could not copy webhook URL", { type: "warning" });
    }
  };

  return (
    <div className="max-w-3xl space-y-8">
      <DesktopMessageAlertsSection />

      {!isAdmin ? (
        <div className="rounded-xl border bg-muted/20 px-4 py-6 text-sm text-muted-foreground">
          Only administrators can configure Twilio SMS.
        </div>
      ) : isPending ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" />
          Loading messaging settings…
        </div>
      ) : error ? (
        <div className="rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-6 text-sm text-destructive">
          Could not load messaging settings. Apply the latest database migration
          and deploy edge functions.
        </div>
      ) : (
        <>
          <div>
            <h2 className="text-sm font-medium text-muted-foreground">
              Twilio SMS
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Connect your Twilio number to send and receive SMS with clients
              from Messages.
            </p>
          </div>

          <div className="grid gap-4">
            <div className="space-y-2">
              <Label htmlFor="twilio-account-sid">Account SID</Label>
              <Input
                id="twilio-account-sid"
                value={accountSid}
                onChange={(event) => setAccountSid(event.target.value)}
                placeholder="ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
                autoComplete="off"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="twilio-auth-token">Auth token</Label>
              <Input
                id="twilio-auth-token"
                type="password"
                value={authToken}
                onChange={(event) => setAuthToken(event.target.value)}
                placeholder={
                  data?.has_auth_token
                    ? "••••••••••••••••"
                    : "Your Twilio auth token"
                }
                autoComplete="new-password"
              />
              <p className="text-xs text-muted-foreground">{configuredHint}</p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="twilio-phone-number">Twilio phone number</Label>
              <Input
                id="twilio-phone-number"
                value={phoneNumber}
                onChange={(event) => setPhoneNumber(event.target.value)}
                placeholder="(555) 123-4567"
                autoComplete="off"
              />
            </div>

            <label className="flex items-center gap-2 text-sm">
              <Checkbox
                checked={smsEnabled}
                onCheckedChange={(checked) => setSmsEnabled(checked === true)}
              />
              Enable SMS messaging
            </label>
          </div>

          <div className="space-y-2 rounded-xl border bg-muted/20 p-4">
            <Label>Inbound webhook URL</Label>
            <p className="text-sm text-muted-foreground">
              Paste this URL in Twilio → Phone Numbers → your number → Messaging
              → &quot;A message comes in&quot; (HTTP POST). Do not use a
              Messaging Service on the number, or configure the same URL on the
              service&apos;s inbound webhook.
            </p>
            <div className="flex flex-col gap-2 sm:flex-row">
              <Input
                readOnly
                value={webhookUrl}
                className="font-mono text-xs"
              />
              <Button
                type="button"
                variant="outline"
                onClick={() => void copyWebhook()}
              >
                <Copy className="size-4" />
                Copy
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Optional: set{" "}
              <code className="rounded bg-muted px-1">TWILIO_WEBHOOK_URL</code>{" "}
              in Supabase if Twilio signature validation fails behind proxies.
            </p>
          </div>

          <div>
            <Button
              type="button"
              onClick={() => saveMutation.mutate()}
              disabled={saveMutation.isPending}
            >
              {saveMutation.isPending ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Save className="size-4" />
              )}
              Save messaging settings
            </Button>
          </div>

          <TestSmsButton disabled={!smsEnabled || saveMutation.isPending} />

          {data ? (
            <BusinessHoursSettingsCard
              settings={data}
              saving={businessHoursMutation.isPending}
              onSave={(payload) => businessHoursMutation.mutate(payload)}
            />
          ) : null}
        </>
      )}

      <OrganizationSignatureSection />

      <FormNotificationsSection />

      <WhatsAppSettingsCard />
      <VoiceSettingsCard />
    </div>
  );
};
