import { Loader2 } from "lucide-react";
import { useDataProvider, useGetIdentity } from "ra-core";
import { useQuery } from "@tanstack/react-query";

import type { CrmDataProvider } from "@/components/atomic-crm/providers/types";
import { GoogleIntegrationPanel } from "@/modules/settings/integrations/GoogleIntegrationPanel";
import { MailIntegrationPanel } from "@/modules/settings/integrations/MailIntegrationPanel";
import { StripeIntegrationPanel } from "@/modules/settings/integrations/StripeIntegrationPanel";
import { TwilioIntegrationPanel } from "@/modules/settings/integrations/TwilioIntegrationPanel";
import { SettingsSubNav } from "@/modules/settings/SettingsSubNav";
import type { ConnectorsSectionId } from "@/modules/settings/settingsNavigation";

export type ConnectorsSettingsSectionProps = {
  activeSection: ConnectorsSectionId;
  onSectionChange: (section: ConnectorsSectionId) => void;
};

export const ConnectorsSettingsSection = ({
  activeSection,
  onSectionChange,
}: ConnectorsSettingsSectionProps) => {
  const dataProvider = useDataProvider<CrmDataProvider>();
  const { identity } = useGetIdentity();
  const isAdmin =
    (identity as { administrator?: boolean } | undefined)?.administrator ===
    true;

  const { data: messagingSettings, isPending } = useQuery({
    queryKey: ["messaging-settings"],
    queryFn: () => dataProvider.getMessagingSettings(),
    enabled: isAdmin,
  });

  if (!isAdmin) {
    return (
      <p className="text-sm text-muted-foreground">Administrators only.</p>
    );
  }

  return (
    <SettingsSubNav
      value={activeSection}
      onValueChange={onSectionChange}
      items={[
        { id: "twilio", label: "Twilio" },
        { id: "mail", label: "Mail" },
        { id: "google", label: "Google" },
        { id: "stripe", label: "Stripe" },
      ]}
      content={
        activeSection === "twilio" ? (
          isPending && !messagingSettings ? (
            <div className="flex items-center gap-2 py-8 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" />
              Loading integrations…
            </div>
          ) : (
            <TwilioIntegrationPanel
              settings={messagingSettings}
              isPending={isPending}
            />
          )
        ) : activeSection === "mail" ? (
          <MailIntegrationPanel />
        ) : activeSection === "stripe" ? (
          <StripeIntegrationPanel />
        ) : (
          <GoogleIntegrationPanel />
        )
      }
    />
  );
};

/** @deprecated Use ConnectorsSettingsSection */
export const MessagingSettingsSection = ConnectorsSettingsSection;
