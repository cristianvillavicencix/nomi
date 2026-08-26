import { useMutation } from "@tanstack/react-query";
import { Copy, Loader2, Save } from "lucide-react";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { IconButton } from "@/components/ui/icon-button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { CrmDataProvider } from "@/components/atomic-crm/providers/types";
import { cn } from "@/lib/utils";
import type { MessagingSettingsPublic } from "@/modules/types";
import { BusinessHoursSettingsCard } from "@/modules/settings/communications/BusinessHoursSettingsCard";
import { IntegrationFeatureSwitchRow } from "@/modules/settings/integrations/IntegrationFeatureSwitchRow";

type PatchPayload = Parameters<CrmDataProvider["updateMessagingSettings"]>[0];
type MessagingProvider = "twilio" | "telnyx";

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
  const savedProvider: MessagingProvider =
    settings?.messaging_provider === "telnyx" ? "telnyx" : "twilio";
  const [draftProvider, setDraftProvider] =
    useState<MessagingProvider>(savedProvider);
  const provider = draftProvider;

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

  const [telnyxApiKey, setTelnyxApiKey] = useState("");
  const [telnyxPhone, setTelnyxPhone] = useState("");
  const [telnyxMessagingProfileId, setTelnyxMessagingProfileId] = useState("");
  const [telnyxTelephonyCredentialId, setTelnyxTelephonyCredentialId] =
    useState("");
  const [telnyxSipConnectionId, setTelnyxSipConnectionId] = useState("");
  const [telnyxSipUsername, setTelnyxSipUsername] = useState("");
  const [telnyxSipPassword, setTelnyxSipPassword] = useState("");
  const [telnyxCallerId, setTelnyxCallerId] = useState("");

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
    setDraftProvider(
      settings.messaging_provider === "telnyx" ? "telnyx" : "twilio",
    );
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

    setTelnyxApiKey("");
    setTelnyxPhone(settings.telnyx_phone_number ?? "");
    setTelnyxMessagingProfileId(settings.telnyx_messaging_profile_id ?? "");
    setTelnyxTelephonyCredentialId(
      settings.telnyx_telephony_credential_id ?? "",
    );
    setTelnyxSipConnectionId(settings.telnyx_sip_connection_id ?? "");
    setTelnyxSipUsername(settings.telnyx_sip_username ?? "");
    setTelnyxSipPassword("");
    setTelnyxCallerId(
      settings.telnyx_caller_id ?? settings.telnyx_phone_number ?? "",
    );
  }, [settings, campaignsConfigured]);

  const saveCredentials = useMutation({
    mutationFn: () => {
      if (provider === "telnyx") {
        const hasKey =
          Boolean(telnyxApiKey.trim()) || settings?.has_telnyx_api_key === true;
        const hasPhone = Boolean(telnyxPhone.trim());
        if (!hasKey || !hasPhone) {
          throw new Error(
            "Telnyx requires an API key and phone number before switching. Fill them in and Save.",
          );
        }
        return onSave({
          messaging_provider: "telnyx",
          telnyx_api_key: telnyxApiKey.trim() || null,
          telnyx_phone_number: telnyxPhone.trim() || null,
          telnyx_messaging_profile_id: telnyxMessagingProfileId.trim() || null,
          telnyx_telephony_credential_id: voiceEnabled
            ? telnyxTelephonyCredentialId.trim() || null
            : null,
          telnyx_sip_connection_id: voiceEnabled
            ? telnyxSipConnectionId.trim() || null
            : null,
          telnyx_sip_username: voiceEnabled
            ? telnyxSipUsername.trim() || null
            : null,
          telnyx_sip_password: voiceEnabled
            ? telnyxSipPassword.trim() || null
            : null,
          telnyx_caller_id: voiceEnabled
            ? telnyxCallerId.trim() || null
            : null,
        });
      }

      return onSave({
        messaging_provider: "twilio",
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
      });
    },
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
      <RadioGroup
        value={provider}
        onValueChange={(value) => {
          // Draft only — persist on Save so we never flip live provider without keys.
          setDraftProvider(value as MessagingProvider);
        }}
        className="grid gap-2 sm:grid-cols-2"
        disabled={patching || saving}
      >
        <label
          htmlFor="messaging-provider-twilio"
          className={cn(
            "flex cursor-pointer gap-3 rounded-lg border p-3",
            provider === "twilio"
              ? "border-primary bg-primary/5 ring-1 ring-primary/20"
              : "bg-muted/10",
          )}
        >
          <RadioGroupItem
            id="messaging-provider-twilio"
            value="twilio"
            className="mt-0.5"
          />
          <div>
            <p className="text-sm font-medium">Twilio</p>
            <p className="text-xs text-muted-foreground">
              SMS, voice, and campaigns via Twilio
            </p>
          </div>
        </label>
        <label
          htmlFor="messaging-provider-telnyx"
          className={cn(
            "flex cursor-pointer gap-3 rounded-lg border p-3",
            provider === "telnyx"
              ? "border-primary bg-primary/5 ring-1 ring-primary/20"
              : "bg-muted/10",
          )}
        >
          <RadioGroupItem
            id="messaging-provider-telnyx"
            value="telnyx"
            className="mt-0.5"
          />
          <div>
            <p className="text-sm font-medium">Telnyx</p>
            <p className="text-xs text-muted-foreground">
              SMS and voice via Telnyx
            </p>
          </div>
        </label>
      </RadioGroup>

      <Tabs key={provider} defaultValue="account" className="w-full">
        <TabsList className="w-full max-w-full justify-start overflow-x-auto">
          <TabsTrigger value="account">Account</TabsTrigger>
          <TabsTrigger value="sms">SMS</TabsTrigger>
          {provider === "twilio" ? (
            <TabsTrigger value="campaigns">Campaigns</TabsTrigger>
          ) : null}
          <TabsTrigger value="voice">Voice</TabsTrigger>
          <TabsTrigger value="hours">Hours</TabsTrigger>
        </TabsList>

        {provider === "twilio" ? (
          <>
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
                  placeholder={
                    settings?.has_auth_token ? "••••••••" : "Auth token"
                  }
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
                <Label htmlFor="marketing-from">Campaign email From</Label>
                <Input
                  id="marketing-from"
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
          </>
        ) : (
          <>
            <TabsContent value="account" className="space-y-3 pt-4">
              <p className="text-xs text-muted-foreground">
                Telnyx API key. Required for SMS and voice.
              </p>
              <div className="space-y-2">
                <Label htmlFor="telnyx-api-key">API key</Label>
                <Input
                  id="telnyx-api-key"
                  type="password"
                  value={telnyxApiKey}
                  onChange={(e) => setTelnyxApiKey(e.target.value)}
                  placeholder={
                    settings?.has_telnyx_api_key ? "••••••••" : "KEY…"
                  }
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
                <Label htmlFor="telnyx-phone">SMS phone number</Label>
                <Input
                  id="telnyx-phone"
                  value={telnyxPhone}
                  onChange={(e) => setTelnyxPhone(e.target.value)}
                  placeholder="+1…"
                  autoComplete="off"
                  disabled={!smsEnabled}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="telnyx-profile">Messaging profile ID</Label>
                <Input
                  id="telnyx-profile"
                  value={telnyxMessagingProfileId}
                  onChange={(e) => setTelnyxMessagingProfileId(e.target.value)}
                  placeholder="Profile ID"
                  autoComplete="off"
                  disabled={!smsEnabled}
                />
              </div>
              {settings?.telnyx_webhook_url ? (
                <WebhookCopyRow
                  label="Inbound SMS webhook"
                  value={settings.telnyx_webhook_url}
                />
              ) : null}
              {settings?.telnyx_status_webhook_url ? (
                <WebhookCopyRow
                  label="SMS status webhook"
                  value={settings.telnyx_status_webhook_url}
                />
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
                <Label htmlFor="telnyx-telephony-id">
                  Telephony credential ID
                </Label>
                <Input
                  id="telnyx-telephony-id"
                  value={telnyxTelephonyCredentialId}
                  onChange={(e) =>
                    setTelnyxTelephonyCredentialId(e.target.value)
                  }
                  placeholder="Credential ID"
                  disabled={!voiceEnabled}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="telnyx-sip-connection">SIP connection ID</Label>
                <Input
                  id="telnyx-sip-connection"
                  value={telnyxSipConnectionId}
                  onChange={(e) => setTelnyxSipConnectionId(e.target.value)}
                  placeholder="Connection ID"
                  disabled={!voiceEnabled}
                />
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="telnyx-sip-user">SIP username</Label>
                  <Input
                    id="telnyx-sip-user"
                    value={telnyxSipUsername}
                    onChange={(e) => setTelnyxSipUsername(e.target.value)}
                    autoComplete="off"
                    disabled={!voiceEnabled}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="telnyx-sip-pass">SIP password</Label>
                  <Input
                    id="telnyx-sip-pass"
                    type="password"
                    value={telnyxSipPassword}
                    onChange={(e) => setTelnyxSipPassword(e.target.value)}
                    placeholder={
                      settings?.has_telnyx_sip_password ? "••••••••" : "Password"
                    }
                    autoComplete="new-password"
                    disabled={!voiceEnabled}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="telnyx-caller">Caller ID</Label>
                <Input
                  id="telnyx-caller"
                  value={telnyxCallerId}
                  onChange={(e) => setTelnyxCallerId(e.target.value)}
                  placeholder="Same as SMS number"
                  disabled={!voiceEnabled}
                />
              </div>
            </TabsContent>
          </>
        )}

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
                saving={patching}
                onSave={(payload) => onPatch(payload)}
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
          Save messaging settings
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
