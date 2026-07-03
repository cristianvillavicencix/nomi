import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useDataProvider, useNotify } from "ra-core";
import { useMemo, useState } from "react";

import type { CrmDataProvider } from "@/components/atomic-crm/providers/types";
import type { MessagingSettingsPublic } from "@/modules/types";
import {
  IntegrationFeatureToggle,
  IntegrationListRow,
} from "@/modules/settings/integrations/IntegrationListRow";
import { IntegrationTestDialog } from "@/modules/settings/integrations/IntegrationTestDialog";
import { TwilioCredentialsDialog } from "@/modules/settings/integrations/TwilioCredentialsDialog";

type Props = {
  settings: MessagingSettingsPublic | undefined;
  isPending: boolean;
};

export const TwilioIntegrationRow = ({ settings, isPending }: Props) => {
  const dataProvider = useDataProvider<CrmDataProvider>();
  const notify = useNotify();
  const queryClient = useQueryClient();
  const [editOpen, setEditOpen] = useState(false);
  const [testOpen, setTestOpen] = useState(false);

  const connected = Boolean(
    settings?.has_auth_token && settings?.twilio_account_sid,
  );

  const campaignsOn = Boolean(
    settings?.twilio_marketing_messaging_service_sid?.trim() ||
      settings?.twilio_marketing_phone_number?.trim(),
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

  const toggleField = (
    field: "sms_enabled" | "voice_enabled",
    checked: boolean,
  ) => {
    if (!connected) return;
    void updateMutation.mutateAsync({ [field]: checked });
  };

  const toggleCampaigns = (checked: boolean) => {
    if (!connected) return;
    if (checked && !campaignsOn) {
      setEditOpen(true);
      return;
    }
    if (!checked) {
      void updateMutation.mutateAsync({
        twilio_marketing_messaging_service_sid: null,
        twilio_marketing_phone_number: null,
        marketing_email_from: null,
      });
    }
  };

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
    });
  };

  const subtitle = connected
    ? settings?.twilio_phone_number || settings?.twilio_account_sid || "Connected"
    : "One account for SMS, voice, and campaigns";

  return (
    <>
      <IntegrationListRow
        name="Twilio"
        subtitle={isPending ? "Loading…" : subtitle}
        status={status}
        toggles={
          connected ? (
            <>
              <IntegrationFeatureToggle
                label="SMS"
                checked={settings?.sms_enabled === true}
                disabled={updateMutation.isPending}
                onCheckedChange={(checked) => toggleField("sms_enabled", checked)}
              />
              <IntegrationFeatureToggle
                label="Voice"
                checked={settings?.voice_enabled === true}
                disabled={updateMutation.isPending}
                onCheckedChange={(checked) =>
                  toggleField("voice_enabled", checked)
                }
              />
              <IntegrationFeatureToggle
                label="Campaigns"
                checked={campaignsOn}
                disabled={updateMutation.isPending}
                onCheckedChange={toggleCampaigns}
              />
            </>
          ) : null
        }
        onConnect={() => setEditOpen(true)}
        onEdit={() => setEditOpen(true)}
        onTest={() => setTestOpen(true)}
        onRemove={removeCredentials}
        testDisabled={!connected || !settings?.sms_enabled}
        removeDisabled={updateMutation.isPending}
      />

      <TwilioCredentialsDialog
        open={editOpen}
        onOpenChange={setEditOpen}
        settings={settings}
        saving={updateMutation.isPending}
        onSave={(payload) => updateMutation.mutateAsync(payload)}
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
    </>
  );
};
