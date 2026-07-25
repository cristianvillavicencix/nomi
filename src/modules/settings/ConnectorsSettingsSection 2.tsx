import { Loader2 } from "lucide-react";
import { useDataProvider, useGetIdentity } from "ra-core";
import { useQuery } from "@tanstack/react-query";

import type { CrmDataProvider } from "@/components/atomic-crm/providers/types";
import { AskNomiIntegrationPanel } from "@/modules/settings/integrations/AskNomiIntegrationPanel";
import { GoogleIntegrationPanel } from "@/modules/settings/integrations/GoogleIntegrationPanel";
import { MailAccountsPanel } from "@/modules/settings/integrations/MailAccountsPanel";
import { MailIntegrationPanel } from "@/modules/settings/integrations/MailIntegrationPanel";
import { StripeIntegrationPanel } from "@/modules/settings/integrations/StripeIntegrationPanel";
import { TwilioIntegrationPanel } from "@/modules/settings/integrations/TwilioIntegrationPanel";
import { HostingerIntegrationPanel } from "@/modules/settings/integrations/HostingerIntegrationPanel";
import { SettingsSubNav } from "@/modules/settings/SettingsSubNav";
import type { ConnectorsSectionId } from "@/modules/settings/settingsNavigation";
import { hasMemberCapability } from "@/components/atomic-crm/providers/commons/memberModuleAccess";

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
  const canMailboxes =
    hasMemberCapability(identity as any, "mail.org.manage") ||
    hasMemberCapability(identity as any, "mail.personal.manage") ||
    hasMemberCapability(identity as any, "mail.org.view") ||
    hasMemberCapability(identity as any, "mail.personal.view");

  const { data: messagingSettings, isPending } = useQuery({
    queryKey: ["messaging-settings"],
    queryFn: () => dataProvider.getMessagingSettings(),
    enabled: isAdmin,
  });

  if (!isAdmin && !canMailboxes) {
    return (
      <p className="text-sm text-muted-foreground">Administrators only.</p>
    );
  }

  const navItems = [
    ...(isAdmin
      ? [
          { id: "twilio" as const, label: "Twilio" },
          { id: "mail" as const, label: "Mail" },
        ]
      : []),
    ...(canMailboxes ? [{ id: "mailboxes" as const, label: "Mailboxes" }] : []),
    ...(isAdmin
      ? [
          { id: "google" as const, label: "Google" },
          { id: "stripe" as const, label: "Stripe" },
          { id: "hostinger" as const, label: "Hostinger" },
          { id: "ask-nomi" as const, label: "Ask Sigma" },
        ]
      : []),
  ];

  const section =
    navItems.some((i) => i.id === activeSection)
      ? activeSection
      : (navItems[0]?.id ?? "mailboxes");

  return (
    <SettingsSubNav
      value={section}
      onValueChange={onSectionChange}
      items={navItems}
      content={
        section === "mailboxes" ? (
          <MailAccountsPanel />
        ) : !isAdmin ? (
          <p className="text-sm text-muted-foreground">Administrators only.</p>
        ) : section === "twilio" ? (
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
        ) : section === "mail" ? (
          <MailIntegrationPanel />
        ) : section === "stripe" ? (
          <StripeIntegrationPanel />
        ) : section === "hostinger" ? (
          <HostingerIntegrationPanel />
        ) : section === "ask-nomi" ? (
          <AskNomiIntegrationPanel />
        ) : (
          <GoogleIntegrationPanel />
        )
      }
    />
  );
};

/** @deprecated Use ConnectorsSettingsSection */
export const MessagingSettingsSection = ConnectorsSettingsSection;
