import { useMutation } from "@tanstack/react-query";
import { Copy, Loader2, Save } from "lucide-react";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import type { CrmDataProvider } from "@/components/atomic-crm/providers/types";
import type { MessagingSettingsPublic } from "@/modules/types";
import { BusinessHoursSettingsCard } from "@/modules/settings/communications/BusinessHoursSettingsCard";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  settings: MessagingSettingsPublic | undefined;
  onSave: (
    payload: Parameters<CrmDataProvider["updateMessagingSettings"]>[0],
  ) => Promise<MessagingSettingsPublic>;
  saving?: boolean;
};

export const TwilioCredentialsDialog = ({
  open,
  onOpenChange,
  settings,
  onSave,
  saving,
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

  useEffect(() => {
    if (!open || !settings) return;
    setAccountSid(settings.twilio_account_sid ?? "");
    setPhoneNumber(settings.twilio_phone_number ?? "");
    setAuthToken("");
    setMessagingServiceSid(settings.twilio_marketing_messaging_service_sid ?? "");
    setMarketingPhone(settings.twilio_marketing_phone_number ?? "");
    setMarketingEmailFrom(settings.marketing_email_from ?? "");
    setTwimlAppSid(settings.voice_twiml_app_sid ?? "");
    setApiKeySid(settings.voice_api_key_sid ?? "");
    setApiKeySecret("");
    setCallerId(settings.voice_caller_id ?? settings.twilio_phone_number ?? "");
  }, [open, settings]);

  const saveCredentials = useMutation({
    mutationFn: () =>
      onSave({
        twilio_account_sid: accountSid.trim() || null,
        twilio_auth_token: authToken.trim() || null,
        twilio_phone_number: phoneNumber.trim() || null,
        twilio_marketing_messaging_service_sid:
          messagingServiceSid.trim() || null,
        twilio_marketing_phone_number: marketingPhone.trim() || null,
        marketing_email_from: marketingEmailFrom.trim() || null,
        voice_twiml_app_sid: twimlAppSid.trim() || null,
        voice_api_key_sid: apiKeySid.trim() || null,
        voice_api_key_secret: apiKeySecret.trim() || null,
        voice_caller_id: callerId.trim() || null,
      }),
    onSuccess: () => {
      onOpenChange(false);
    },
  });

  const copyUrl = async (value: string | null | undefined) => {
    if (!value) return;
    await navigator.clipboard.writeText(value);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Twilio credentials</DialogTitle>
        </DialogHeader>

        <Tabs defaultValue="account" className="w-full">
          <TabsList className="w-full">
            <TabsTrigger value="account" className="flex-1">
              Account
            </TabsTrigger>
            <TabsTrigger value="campaigns" className="flex-1">
              Campaigns
            </TabsTrigger>
            <TabsTrigger value="voice" className="flex-1">
              Voice
            </TabsTrigger>
            <TabsTrigger value="hours" className="flex-1">
              Hours
            </TabsTrigger>
          </TabsList>

          <TabsContent value="account" className="space-y-3 pt-4">
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
            <div className="space-y-2">
              <Label htmlFor="twilio-phone">Phone number</Label>
              <Input
                id="twilio-phone"
                value={phoneNumber}
                onChange={(e) => setPhoneNumber(e.target.value)}
                placeholder="+1…"
                autoComplete="off"
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
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    onClick={() => void copyUrl(settings.webhook_url)}
                  >
                    <Copy className="size-4" />
                  </Button>
                </div>
              </div>
            ) : null}
          </TabsContent>

          <TabsContent value="campaigns" className="space-y-3 pt-4">
            <div className="space-y-2">
              <Label htmlFor="marketing-sid">Messaging Service SID</Label>
              <Input
                id="marketing-sid"
                value={messagingServiceSid}
                onChange={(e) => setMessagingServiceSid(e.target.value)}
                placeholder="MG…"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="marketing-phone">Fallback phone</Label>
              <Input
                id="marketing-phone"
                value={marketingPhone}
                onChange={(e) => setMarketingPhone(e.target.value)}
                placeholder="If no Messaging Service"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="marketing-from">Campaign email From</Label>
              <Input
                id="marketing-from"
                value={marketingEmailFrom}
                onChange={(e) => setMarketingEmailFrom(e.target.value)}
                placeholder="Marketing <news@company.com>"
              />
            </div>
          </TabsContent>

          <TabsContent value="voice" className="space-y-3 pt-4">
            <div className="space-y-2">
              <Label htmlFor="voice-twiml">TwiML App SID</Label>
              <Input
                id="voice-twiml"
                value={twimlAppSid}
                onChange={(e) => setTwimlAppSid(e.target.value)}
                placeholder="AP…"
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
              />
            </div>
            {settings?.voice_twiml_url ? (
              <WebhookCopyRow label="TwiML URL" value={settings.voice_twiml_url} />
            ) : null}
            {settings?.voice_status_webhook_url ? (
              <WebhookCopyRow
                label="Status URL"
                value={settings.voice_status_webhook_url}
              />
            ) : null}
            {settings?.voice_inbound_url ? (
              <WebhookCopyRow
                label="Inbound URL"
                value={settings.voice_inbound_url}
              />
            ) : null}
          </TabsContent>

          <TabsContent value="hours" className="pt-4">
            {settings ? (
              <BusinessHoursSettingsCard
                embedded
                settings={settings}
                saving={saving}
                onSave={(payload) => onSave(payload)}
              />
            ) : null}
          </TabsContent>
        </Tabs>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </Button>
          <Button
            type="button"
            disabled={saveCredentials.isPending || saving}
            onClick={() => saveCredentials.mutate()}
          >
            {saveCredentials.isPending ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Save className="size-4" />
            )}
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

const WebhookCopyRow = ({
  label,
  value,
}: {
  label: string;
  value: string;
}) => (
  <div className="space-y-1">
    <Label className="text-xs">{label}</Label>
    <div className="flex gap-2">
      <Input readOnly value={value} className="font-mono text-[10px]" />
      <Button
        type="button"
        variant="outline"
        size="icon"
        onClick={() => void navigator.clipboard.writeText(value)}
      >
        <Copy className="size-4" />
      </Button>
    </div>
  </div>
);
