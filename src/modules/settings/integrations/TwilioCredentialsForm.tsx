import { useMutation } from "@tanstack/react-query";
import { Copy, Loader2, Save } from "lucide-react";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { IconButton } from "@/components/ui/icon-button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { CrmDataProvider } from "@/components/atomic-crm/providers/types";
import type { MessagingSettingsPublic } from "@/modules/types";
import { BusinessHoursSettingsCard } from "@/modules/settings/communications/BusinessHoursSettingsCard";
import { IntegrationFeatureSwitchRow } from "@/modules/settings/integrations/IntegrationFeatureSwitchRow";

type PatchPayload = Parameters<CrmDataProvider["updateMessagingSettings"]>[0];

type Props = {
  settings: MessagingSettingsPublic | undefined;
  connected: boolean;
  onSave: (payload: PatchPayload) => Promise<MessagingSettingsPublic>;
  onPatch: (payload: PatchPayload) => Promise<MessagingSettingsPublic>;
  saving?: boolean;
  patching?: boolean;
  onSaveSuccess?: () => void;
  onTestSms?: () => void;
};

export const TwilioCredentialsForm = ({
  settings,
  connected,
  onSave,
  onPatch,
  saving,
  patching,
  onSaveSuccess,
  onTestSms,
}: Props) => {
  const [accountSid, setAccountSid] = useState("");
  const [authToken, setAuthToken] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [messagingServiceSid, setMessagingServiceSid] = useState("");
  const [marketingPhone, setMarketingPhone] = useState("");
  const [marketingEmailFrom, setMarketingEmailFrom] = useState("");
  const [twimlAppSid, setTwimlAppSid] = useState("");
  const [apiKeySid, setApiKeySid] = useState("");
  const [apiKeySecret, setApiKeySecret] = useState("");
  const [callerId, setCallerId] = useState("");
  const [campaignsDraftEnabled, setCampaignsDraftEnabled] = useState(false);

  const campaignsConfigured = Boolean(
    settings?.twilio_marketing_messaging_service_sid?.trim() ||
      settings?.twilio_marketing_phone_number?.trim(),
  );
  const campaignsEnabled = campaignsConfigured || campaignsDraftEnabled;
  const smsEnabled = settings?.sms_enabled === true;
  const voiceEnabled = settings?.voice_enabled === true;
  const hoursEnabled = settings?.auto_acknowledge_enabled === true;

  useEffect(() => {
    if (!settings) return;
    setAccountSid(settings.twilio_account_sid ?? "");
    setPhoneNumber(settings.twilio_phone_number ?? "");
    setAuthToken("");
    setMessagingServiceSid(
      settings.twilio_marketing_messaging_service_sid ?? "",
    );
    setMarketingPhone(settings.twilio_marketing_phone_number ?? "");
    setMarketingEmailFrom(settings.marketing_email_from ?? "");
    setTwimlAppSid(settings.voice_twiml_app_sid ?? "");
    setApiKeySid(settings.voice_api_key_sid ?? "");
    setApiKeySecret("");
    setCallerId(settings.voice_caller_id ?? settings.twilio_phone_number ?? "");
    setCampaignsDraftEnabled((current) =>
      campaignsConfigured ? true : current,
    );
  }, [settings]);

  const saveCredentials = useMutation({
    mutationFn: () =>
      onSave({
        twilio_account_sid: accountSid.trim() || null,
        twilio_auth_token: authToken.trim() || null,
        twilio_phone_number: phoneNumber.trim() || null,
        twilio_marketing_messaging_service_sid: campaignsEnabled
          ? messagingServiceSid.trim() || null
          : null,
        twilio_marketing_phone_number: campaignsEnabled
          ? marketingPhone.trim() || null
          : null,
        marketing_email_from: campaignsEnabled
          ? marketingEmailFrom.trim() || null
          : null,
        voice_twiml_app_sid: voiceEnabled ? twimlAppSid.trim() || null : null,
        voice_api_key_sid: voiceEnabled ? apiKeySid.trim() || null : null,
        voice_api_key_secret: voiceEnabled ? apiKeySecret.trim() || null : null,
        voice_caller_id: voiceEnabled ? callerId.trim() || null : null,
      }),
    onSuccess: () => {
      onSaveSuccess?.();
    },
  });

  const copyUrl = async (value: string | null | undefined) => {
    if (!value) return;
    await navigator.clipboard.writeText(value);
  };

  const featureDisabled = !connected || patching || saving;

  return (
    <div className="space-y-4">
      <Tabs defaultValue="account" className="w-full">
        <TabsList className="w-full max-w-full justify-start overflow-x-auto">
          <TabsTrigger value="account">Account</TabsTrigger>
          <TabsTrigger value="sms">SMS</TabsTrigger>
          <TabsTrigger value="campaigns">Campaigns</TabsTrigger>
          <TabsTrigger value="voice">Voice</TabsTrigger>
          <TabsTrigger value="hours">Hours</TabsTrigger>
        </TabsList>

        <TabsContent value="account" className="space-y-3 pt-4">
          <p className="text-xs text-muted-foreground">
            Core Twilio credentials. Required for SMS, voice, campaigns, and
            system email.
          </p>
          <div className="space-y-2">
            <Label htmlFor="twilio-sid">Account SID</Label>
            <Input
              id="twilio-sid"
              value={accountSid}
              onChange={(e) => setAccountSid(e.target.value)}
              placeholder="AC…"
              autoComplete="off"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="twilio-token">Auth token</Label>
            <Input
              id="twilio-token"
              type="password"
              value={authToken}
              onChange={(e) => setAuthToken(e.target.value)}
              placeholder={settings?.has_auth_token ? "••••••••" : "Auth token"}
              autoComplete="new-password"
            />
          </div>
        </TabsContent>

        <TabsContent value="sms" className="space-y-3 pt-4">
          <IntegrationFeatureSwitchRow
            label="Enable SMS"
            description="Two-way SMS in the Messages inbox and outbound texts."
            checked={smsEnabled}
            disabled={featureDisabled}
            onCheckedChange={(checked) => {
              void onPatch({ sms_enabled: checked });
            }}
          />
          <div className="space-y-2">
            <Label htmlFor="twilio-phone">SMS phone number</Label>
            <Input
              id="twilio-phone"
              value={phoneNumber}
              onChange={(e) => setPhoneNumber(e.target.value)}
              placeholder="+1…"
              autoComplete="off"
              disabled={!smsEnabled}
            />
          </div>
          {settings?.webhook_url ? (
            <div className="space-y-2">
              <Label>Inbound SMS webhook</Label>
              <div className="flex gap-2">
                <Input
                  readOnly
                  value={settings.webhook_url}
                  className="font-mono text-xs"
                />
                <IconButton
                  aria-label="Copy"
                  variant="secondary"
                  onClick={() => void copyUrl(settings.webhook_url)}
                >
                  <Copy className="size-4" />
                </IconButton>
              </div>
              <p className="text-[11px] text-muted-foreground">
                Paste this URL in Twilio Console → Phone number → Messaging
                webhook.
              </p>
            </div>
          ) : null}
          {onTestSms ? (
            <Button
              type="button"
              variant="secondary"
              size="sm"
              disabled={!smsEnabled || featureDisabled}
              onClick={onTestSms}
            >
              Send test SMS
            </Button>
          ) : null}
        </TabsContent>

        <TabsContent value="campaigns" className="space-y-3 pt-4">
          <IntegrationFeatureSwitchRow
            label="Enable campaigns"
            description="Marketing SMS and email blasts to opted-in contacts."
            checked={campaignsEnabled}
            disabled={featureDisabled}
            onCheckedChange={(checked) => {
              if (checked) {
                setCampaignsDraftEnabled(true);
                return;
              }
              setCampaignsDraftEnabled(false);
              void onPatch({
                twilio_marketing_messaging_service_sid: null,
                twilio_marketing_phone_number: null,
                marketing_email_from: null,
              });
            }}
          />
          <div className="space-y-2">
            <Label htmlFor="marketing-sid">Messaging Service SID</Label>
            <Input
              id="marketing-sid"
              value={messagingServiceSid}
              onChange={(e) => setMessagingServiceSid(e.target.value)}
              placeholder="MG…"
              disabled={!campaignsEnabled}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="marketing-phone">Fallback phone</Label>
            <Input
              id="marketing-phone"
              value={marketingPhone}
              onChange={(e) => setMarketingPhone(e.target.value)}
              placeholder="If no Messaging Service"
              disabled={!campaignsEnabled}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="marketing-from ">Campaign email From</Label>
            <Input
              id="marketing-from "
              value={marketingEmailFrom}
              onChange={(e) => setMarketingEmailFrom(e.target.value)}
              placeholder="Marketing <news@company.com>"
              disabled={!campaignsEnabled}
            />
          </div>
        </TabsContent>

        <TabsContent value="voice" className="space-y-3 pt-4">
          <IntegrationFeatureSwitchRow
            label="Enable voice"
            description="Outbound and inbound calls from the CRM."
            checked={voiceEnabled}
            disabled={featureDisabled}
            onCheckedChange={(checked) => {
              void onPatch({ voice_enabled: checked });
            }}
          />
          <div className="space-y-2">
            <Label htmlFor="voice-twiml">TwiML App SID</Label>
            <Input
              id="voice-twiml"
              value={twimlAppSid}
              onChange={(e) => setTwimlAppSid(e.target.value)}
              placeholder="AP…"
              disabled={!voiceEnabled}
            />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="voice-api-sid">API Key SID</Label>
              <Input
                id="voice-api-sid"
                value={apiKeySid}
                onChange={(e) => setApiKeySid(e.target.value)}
                placeholder="SK…"
                disabled={!voiceEnabled}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="voice-api-secret">API Key secret</Label>
              <Input
                id="voice-api-secret"
                type="password"
                value={apiKeySecret}
                onChange={(e) => setApiKeySecret(e.target.value)}
                placeholder={
                  settings?.has_voice_api_key_secret ? "••••••••" : "Secret"
                }
                disabled={!voiceEnabled}
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="voice-caller">Caller ID</Label>
            <Input
              id="voice-caller"
              value={callerId}
              onChange={(e) => setCallerId(e.target.value)}
              placeholder="Same as SMS number"
              disabled={!voiceEnabled}
            />
          </div>
          {voiceEnabled && settings?.voice_twiml_url ? (
            <WebhookCopyRow
              label="TwiML URL"
              value={settings.voice_twiml_url}
            />
          ) : null}
          {voiceEnabled && settings?.voice_status_webhook_url ? (
            <WebhookCopyRow
              label="Status URL"
              value={settings.voice_status_webhook_url}
            />
          ) : null}
          {voiceEnabled && settings?.voice_inbound_url ? (
            <WebhookCopyRow
              label="Inbound URL"
              value={settings.voice_inbound_url}
            />
          ) : null}
        </TabsContent>

        <TabsContent value="hours" className="space-y-3 pt-4">
          <IntegrationFeatureSwitchRow
            label="Enable auto-acknowledge"
            description="Automatic reply when a new SMS arrives during business hours."
            checked={hoursEnabled}
            disabled={featureDisabled}
            onCheckedChange={(checked) => {
              void onPatch({ auto_acknowledge_enabled: checked });
            }}
          />
          {settings ? (
            <div
              className={
                hoursEnabled ? undefined : "pointer-events-none opacity-50"
              }
            >
              <BusinessHoursSettingsCard
                embedded
                settings={settings}
                saving={saving}
                onSave={(payload) => onSave(payload)}
              />
            </div>
          ) : null}
        </TabsContent>
      </Tabs>

      <div className="flex justify-end border-t border-border/40 pt-4">
        <Button
          type="button"
          disabled={saveCredentials.isPending || saving || patching}
          onClick={() => saveCredentials.mutate()}
        >
          {saveCredentials.isPending ? (
            <Loader2 className="mr-2 size-4 animate-spin" />
          ) : (
            <Save className="mr-2 size-4" />
          )}
          Save Twilio settings
        </Button>
      </div>
    </div>
  );
};

const WebhookCopyRow = ({ label, value }: { label: string; value: string }) => (
  <div className="space-y-1">
    <Label className="text-xs">{label}</Label>
    <div className="flex gap-2">
      <Input readOnly value={value} className="font-mono text-[10px]" />
      <IconButton
        aria-label="Copy"
        variant="secondary"
        onClick={() => void navigator.clipboard.writeText(value)}
      >
        <Copy className="size-4" />
      </IconButton>
    </div>
  </div>
);
