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

  const connected = Boolean(
    settings?.has_auth_token && settings?.twilio_account_sid,
  );

  const status = useMemo(() => {
    if (!connected) return "off" as const;
    if (!settings?.twilio_phone_number) return "partial" as const;
    return "connected" as const;
  }, [connected, settings?.twilio_phone_number]);

  const updateMutation = useMutation({
    mutationFn: (
      payload: Parameters<CrmDataProvider["updateMessagingSettings"]>[0],
    ) => dataProvider.updateMessagingSettings(payload),
    onSuccess: (saved) => {
      queryClient.setQueryData(["messaging-settings"], saved);
      notify("Twilio updated", { type: "success" });
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
        "Remove Twilio credentials? SMS, voice, and campaigns will stop working.",
      )
    ) {
      return;
    }
    void updateMutation.mutateAsync({
      twilio_account_sid: null,
      twilio_auth_token: null,
      twilio_phone_number: null,
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
        Loading Twilio…
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <IntegrationPanelHeader
        title="Twilio"
        description="SMS, voice, marketing campaigns, and shared credentials for system email."
        status={status}
        meta={settings?.twilio_phone_number ?? settings?.twilio_account_sid ?? undefined}
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
        title="Test Twilio SMS"
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
