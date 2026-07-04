import { useQuery } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { useDataProvider, useGetIdentity } from "ra-core";

import { useMemberCapability } from "@/components/atomic-crm/providers/commons/useMemberCapability";
import type { CrmDataProvider } from "@/components/atomic-crm/providers/types";
import {
  buildEmailSendersTableData,
  EmailSendersTable,
} from "@/modules/settings/integrations/EmailSendersTable";
import { IntegrationPanelHeader } from "@/modules/settings/integrations/IntegrationPanelHeader";
import { SettingsSubNav } from "@/modules/settings/SettingsSubNav";
import { TicketEmailInboundSetupCard } from "@/modules/settings/TicketEmailInboundSetupCard";
import { TicketInboxReplySignatureSection } from "@/modules/settings/TicketInboxReplySignatureSection";
import { TicketInboxReplyTemplatesSection } from "@/modules/settings/TicketInboxReplyTemplatesSection";
import type { TicketsSectionId } from "@/modules/settings/settingsNavigation";
import { DEFAULT_TICKET_INBOX_EMAIL } from "@/modules/tickets/ticketInboxConfig";

type Props = {
  activeSection: TicketsSectionId;
  onSectionChange: (section: TicketsSectionId) => void;
};

export const TicketsSettingsSection = ({
  activeSection,
  onSectionChange,
}: Props) => {
  const dataProvider = useDataProvider<CrmDataProvider>();
  const { identity } = useGetIdentity();
  const isAdmin =
    (identity as { administrator?: boolean } | undefined)?.administrator ===
    true;
  const canManageSettings = useMemberCapability("admin.settings.manage");
  const canManageTickets = useMemberCapability("support.tickets.manage");
  const canAccess =
    isAdmin || canManageSettings || canManageTickets;

  const { data, isPending } = useQuery({
    queryKey: ["email-delivery-settings"],
    queryFn: () => dataProvider.getEmailDeliverySettings(),
    enabled: isAdmin,
  });

  if (!canAccess) {
    return (
      <p className="text-sm text-muted-foreground">
        You do not have permission to manage ticket settings.
      </p>
    );
  }

  const configured = data?.configured === true;
  const inboxEmail =
    data?.ticket_inbound?.support_email?.trim() || DEFAULT_TICKET_INBOX_EMAIL;
  const inboxStatus = data?.ticket_inbound?.webhook_configured
    ? ("connected" as const)
    : configured
      ? ("partial" as const)
      : ("off" as const);

  const inboxPanel = isAdmin ? (
    isPending ? (
      <div className="flex items-center gap-2 py-8 text-sm text-muted-foreground">
        <Loader2 className="size-4 animate-spin" />
        Loading inbox settings…
      </div>
    ) : (
      <div className="space-y-6">
        <IntegrationPanelHeader
          title="Support inbox"
          description={`Clients email ${inboxEmail}. Outbound ticket replies send from the same address via Twilio.`}
          status={inboxStatus}
          meta={inboxEmail}
        />

        {!configured ? (
          <p className="text-sm text-muted-foreground">
            Connect Twilio under Integrations → Twilio first. Outbound ticket
            replies use the same email credentials as system mail.
          </p>
        ) : null}

        <EmailSendersTable
          configured={configured}
          data={buildEmailSendersTableData(data!)}
          channels={["ticket"]}
        />

        <TicketEmailInboundSetupCard setup={data?.ticket_inbound ?? null} />
      </div>
    )
  ) : (
    <p className="text-sm text-muted-foreground">
      Inbox address and inbound DNS require an administrator. You can still edit
      reply signature and templates in the other tabs.
    </p>
  );

  return (
    <SettingsSubNav
      value={activeSection}
      onValueChange={onSectionChange}
      items={[
        { id: "inbox", label: "Inbox" },
        { id: "signature", label: "Reply signature" },
        { id: "templates", label: "Reply templates" },
      ]}
      content={
        activeSection === "inbox" ? (
          inboxPanel
        ) : activeSection === "signature" ? (
          <TicketInboxReplySignatureSection />
        ) : (
          <TicketInboxReplyTemplatesSection />
        )
      }
    />
  );
};
