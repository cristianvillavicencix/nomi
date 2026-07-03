import { Loader2 } from "lucide-react";
import { useDataProvider, useGetIdentity } from "ra-core";
import { useQuery } from "@tanstack/react-query";

import type { CrmDataProvider } from "@/components/atomic-crm/providers/types";
import { EmailIntegrationRow } from "@/modules/settings/integrations/EmailIntegrationRow";
import { TicketInboxIntegrationRow } from "@/modules/settings/integrations/TicketInboxIntegrationRow";
import { GoogleGscIntegrationRow } from "@/modules/settings/integrations/GoogleGscIntegrationRow";
import { TwilioIntegrationRow } from "@/modules/settings/integrations/TwilioIntegrationRow";
import {
  SettingsRows,
  SettingsSection,
} from "@/modules/settings/SettingsSection";

/** @deprecated Sections are ignored — single integrations list. */
export type ConnectorsSettingsSectionProps = {
  activeSection?: string;
  onSectionChange?: (section: string) => void;
};

export const ConnectorsSettingsSection = (_props?: ConnectorsSettingsSectionProps) => {
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
    <div className="space-y-8">
      <SettingsSection title="Messaging">
        <SettingsRows>
          {isPending ? (
            <div className="flex items-center gap-2 py-4 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" />
              Loading integrations…
            </div>
          ) : (
            <TwilioIntegrationRow
              settings={messagingSettings}
              isPending={isPending}
            />
          )}
          <EmailIntegrationRow />
          <TicketInboxIntegrationRow />
        </SettingsRows>
      </SettingsSection>

      <SettingsSection title="Analytics">
        <SettingsRows>
          <GoogleGscIntegrationRow />
        </SettingsRows>
      </SettingsSection>
    </div>
  );
};

/** @deprecated Use ConnectorsSettingsSection */
export const MessagingSettingsSection = ConnectorsSettingsSection;
