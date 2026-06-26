import { Copy, Loader2, Save } from "lucide-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useDataProvider, useGetIdentity, useNotify } from "ra-core";
import { useEffect, useState } from "react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { CrmDataProvider } from "@/components/atomic-crm/providers/types";

export const VoiceSettingsCard = () => {
  const dataProvider = useDataProvider<CrmDataProvider>();
  const { identity } = useGetIdentity();
  const notify = useNotify();
  const queryClient = useQueryClient();
  const isAdmin =
    (identity as { administrator?: boolean } | undefined)?.administrator ===
    true;

  const { data, isPending } = useQuery({
    queryKey: ["messaging-settings"],
    queryFn: () => dataProvider.getMessagingSettings(),
    enabled: isAdmin,
  });

  const [twimlAppSid, setTwimlAppSid] = useState("");
  const [apiKeySid, setApiKeySid] = useState("");
  const [apiKeySecret, setApiKeySecret] = useState("");
  const [callerId, setCallerId] = useState("");
  const [voiceEnabled, setVoiceEnabled] = useState(false);
  const [recordingDefault, setRecordingDefault] = useState(false);

  useEffect(() => {
    if (!data) return;
    setTwimlAppSid(data.voice_twiml_app_sid ?? "");
    setApiKeySid(data.voice_api_key_sid ?? "");
    setCallerId(data.voice_caller_id ?? data.twilio_phone_number ?? "");
    setVoiceEnabled(data.voice_enabled === true);
    setRecordingDefault(data.voice_recording_default === true);
    setApiKeySecret("");
  }, [data]);

  const saveMutation = useMutation({
    mutationFn: () =>
      dataProvider.updateMessagingSettings({
        voice_enabled: voiceEnabled,
        voice_twiml_app_sid: twimlAppSid.trim() || null,
        voice_api_key_sid: apiKeySid.trim() || null,
        voice_api_key_secret: apiKeySecret.trim() || null,
        voice_caller_id: callerId.trim() || null,
        voice_recording_default: recordingDefault,
      }),
    onSuccess: (saved) => {
      queryClient.setQueryData(["messaging-settings"], saved);
      setApiKeySecret("");
      notify("Voice settings saved", { type: "success" });
    },
    onError: (error) => {
      notify(
        error instanceof Error ? error.message : "Failed to save voice settings",
        { type: "error" },
      );
    },
  });

  const copyUrl = async (value: string | null | undefined, label: string) => {
    if (!value) return;
    try {
      await navigator.clipboard.writeText(value);
      notify(`${label} copied`, { type: "info" });
    } catch {
      notify(`Could not copy ${label}`, { type: "warning" });
    }
  };

  if (!isAdmin) {
    return null;
  }

  return (
    <div className="space-y-4 rounded-xl border border-border/60 p-4">
      <div>
        <h3 className="font-semibold">Voice (Twilio)</h3>
        <p className="text-sm text-muted-foreground">
          Outbound and inbound browser calls from Messages. Uses the same Twilio
          account as SMS.
        </p>
      </div>

      {isPending ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" />
          Loading voice settings…
        </div>
      ) : (
        <>
          <Alert>
            <AlertDescription className="space-y-2 text-sm">
              <p>
                In Twilio Console → TwiML App <strong>nomicrm</strong> → Voice:
              </p>
              <ol className="list-decimal space-y-1 pl-5">
                <li>
                  Request URL: paste the <strong>TwiML webhook URL</strong> below
                </li>
                <li>
                  Status callback URL: paste the <strong>Status webhook URL</strong>
                </li>
                <li>
                  Create an API Key (Account → API keys) and paste SID + secret
                  here
                </li>
                <li>
                  Phone Numbers → your number → Voice → A call comes in: paste the{" "}
                  <strong>Inbound webhook URL</strong> below
                </li>
              </ol>
            </AlertDescription>
          </Alert>

          <div className="space-y-2 rounded-xl border bg-muted/20 p-4">
            <Label>TwiML webhook URL</Label>
            <div className="flex flex-col gap-2 sm:flex-row">
              <Input
                readOnly
                value={data?.voice_twiml_url ?? ""}
                className="font-mono text-xs"
              />
              <Button
                type="button"
                variant="outline"
                onClick={() => void copyUrl(data?.voice_twiml_url, "TwiML URL")}
              >
                <Copy className="size-4" />
                Copy
              </Button>
            </div>
          </div>

          <div className="space-y-2 rounded-xl border bg-muted/20 p-4">
            <Label>Status webhook URL</Label>
            <div className="flex flex-col gap-2 sm:flex-row">
              <Input
                readOnly
                value={data?.voice_status_webhook_url ?? ""}
                className="font-mono text-xs"
              />
              <Button
                type="button"
                variant="outline"
                onClick={() =>
                  void copyUrl(data?.voice_status_webhook_url, "Status URL")
                }
              >
                <Copy className="size-4" />
                Copy
              </Button>
            </div>
          </div>

          <div className="space-y-2 rounded-xl border bg-muted/20 p-4">
            <Label>Inbound webhook URL (phone number)</Label>
            <div className="flex flex-col gap-2 sm:flex-row">
              <Input
                readOnly
                value={data?.voice_inbound_url ?? ""}
                className="font-mono text-xs"
              />
              <Button
                type="button"
                variant="outline"
                onClick={() =>
                  void copyUrl(data?.voice_inbound_url, "Inbound URL")
                }
              >
                <Copy className="size-4" />
                Copy
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Set this on your Twilio phone number under Voice → A call comes in
              (HTTP POST). Rings users with call permission in the CRM.
            </p>
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="voice-twiml-app-sid">TwiML App SID</Label>
              <Input
                id="voice-twiml-app-sid"
                value={twimlAppSid}
                onChange={(event) => setTwimlAppSid(event.target.value)}
                placeholder="APxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
                autoComplete="off"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="voice-api-key-sid">API Key SID</Label>
              <Input
                id="voice-api-key-sid"
                value={apiKeySid}
                onChange={(event) => setApiKeySid(event.target.value)}
                placeholder="SKxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
                autoComplete="off"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="voice-api-key-secret">API Key secret</Label>
              <Input
                id="voice-api-key-secret"
                type="password"
                value={apiKeySecret}
                onChange={(event) => setApiKeySecret(event.target.value)}
                placeholder={
                  data?.has_voice_api_key_secret
                    ? "••••••••••••••••"
                    : "Your API key secret"
                }
                autoComplete="new-password"
              />
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="voice-caller-id">Outbound caller ID</Label>
              <Input
                id="voice-caller-id"
                value={callerId}
                onChange={(event) => setCallerId(event.target.value)}
                placeholder="+1… or 10-digit US number"
                autoComplete="off"
              />
              <p className="text-xs text-muted-foreground">
                Must be a Twilio number on your account (usually the same SMS
                number).
              </p>
            </div>
          </div>

          <label className="flex items-center gap-2 text-sm">
            <Checkbox
              checked={voiceEnabled}
              onCheckedChange={(checked) => setVoiceEnabled(checked === true)}
            />
            Enable voice calling
          </label>

          <label className="flex items-center gap-2 text-sm">
            <Checkbox
              checked={recordingDefault}
              onCheckedChange={(checked) =>
                setRecordingDefault(checked === true)
              }
            />
            Record outbound calls by default
          </label>

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
            Save voice settings
          </Button>
        </>
      )}
    </div>
  );
};
