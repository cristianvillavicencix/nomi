import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { useMemo, useState } from "react";
import { useDataProvider, useNotify } from "ra-core";

import { Button } from "@/components/ui/button";
import type { CrmDataProvider } from "@/components/atomic-crm/providers/types";
import type { MessagingSettingsPublic } from "@/modules/types";
import { IntegrationPanelHeader } from "@/modules/settings/integrations/IntegrationPanelHeader";
import { IntegrationTestDialog } from "@/modules/settings/integrations/IntegrationTestDialog";
import { TwilioCredentialsForm } from "@/modules/settings/integrations/TwilioCredentialsForm";

type Props = {
  settings: MessagingSettingsPublic | undefined;
  isPending: boolean;
};

export const TwilioIntegrationPanel = ({ settings, isPending }: Props) => {
  const dataProvider = useDataProvider<CrmDataProvider>();
  const notify = useNotify();
  const queryClient = useQueryClient();
  const [testOpen, setTestOpen] = useState(false);

  const provider =
    settings?.messaging_provider === "telnyx" ? "telnyx" : "twilio";

  const connected =
    provider === "telnyx"
      ? Boolean(settings?.has_telnyx_api_key)
      : Boolean(settings?.has_auth_token && settings?.twilio_account_sid);

  const activePhone =
    provider === "telnyx"
      ? settings?.telnyx_phone_number
      : settings?.twilio_phone_number;

  const status = useMemo(() => {
    if (!connected) return "off" as const;
    if (!activePhone) return "partial" as const;
    return "connected" as const;
  }, [connected, activePhone]);

  const updateMutation = useMutation({
    mutationFn: (
      payload: Parameters<CrmDataProvider["updateMessagingSettings"]>[0],
    ) => dataProvider.updateMessagingSettings(payload),
    onSuccess: (saved) => {
      queryClient.setQueryData(["messaging-settings"], saved);
      notify("Messaging settings updated", { type: "success" });
    },
    onError: (error) => {
      notify(error instanceof Error ? error.message : "Failed to save", {
        type: "error",
      });
    },
  });

  const patchMutation = useMutation({
    mutationFn: (
      payload: Parameters<CrmDataProvider["updateMessagingSettings"]>[0],
    ) => dataProvider.updateMessagingSettings(payload),
    onSuccess: (saved) => {
      queryClient.setQueryData(["messaging-settings"], saved);
    },
    onError: (error) => {
      notify(error instanceof Error ? error.message : "Failed to update", {
        type: "error",
      });
    },
  });

  const removeCredentials = () => {
    if (
      !window.confirm(
        "Remove messaging credentials? SMS, voice, and campaigns will stop working.",
      )
    ) {
      return;
    }
    void updateMutation.mutateAsync({
      twilio_account_sid: null,
      twilio_auth_token: null,
      twilio_phone_number: null,
      telnyx_api_key: null,
      telnyx_phone_number: null,
      telnyx_messaging_profile_id: null,
      telnyx_sip_connection_id: null,
      telnyx_telephony_credential_id: null,
      telnyx_sip_username: null,
      telnyx_sip_password: null,
      telnyx_caller_id: null,
      sms_enabled: false,
      voice_enabled: false,
      twilio_marketing_messaging_service_sid: null,
      twilio_marketing_phone_number: null,
      marketing_email_from: null,
      voice_twiml_app_sid: null,
      voice_api_key_sid: null,
      voice_api_key_secret: null,
      voice_caller_id: null,
      auto_acknowledge_enabled: false,
    });
  };

  if (isPending) {
    return (
      <div className="flex items-center gap-2 py-8 text-sm text-muted-foreground">
        <Loader2 className="size-4 animate-spin" />
        Loading messaging…
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <IntegrationPanelHeader
        title="Phone & SMS"
        description="SMS and voice via Twilio or Telnyx. Campaigns use Twilio when selected."
        status={status}
        meta={activePhone ?? undefined}
        actions={
          connected ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="text-destructive hover:text-destructive"
              disabled={updateMutation.isPending}
              onClick={removeCredentials}
            >
              Remove
            </Button>
          ) : null
        }
      />

      <TwilioCredentialsForm
        settings={settings}
        connected={connected}
        saving={updateMutation.isPending}
        patching={patchMutation.isPending}
        onSave={(payload) => updateMutation.mutateAsync(payload)}
        onPatch={(payload) => patchMutation.mutateAsync(payload)}
        onTestSms={() => setTestOpen(true)}
      />

      <IntegrationTestDialog
        open={testOpen}
        onOpenChange={setTestOpen}
        title="Test SMS"
        label="Send test to"
        placeholder="+12035551234"
        inputType="tel"
        onSend={async (phone) => {
          await dataProvider.sendTestSms(phone);
          notify("Test SMS sent", { type: "success" });
        }}
      />
    </div>
  );
};
