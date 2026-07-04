import { useQuery } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { useDataProvider, useGetIdentity } from "ra-core";

import { useMemberCapability } from "@/components/atomic-crm/providers/commons/useMemberCapability";
import type { CrmDataProvider } from "@/components/atomic-crm/providers/types";
import { TicketInboundPanel } from "@/modules/settings/integrations/TicketInboundPanel";
import { TicketOutboundPanel } from "@/modules/settings/integrations/TicketOutboundPanel";
import { SettingsSubNav } from "@/modules/settings/SettingsSubNav";
import { TicketAutomationsPanel } from "@/modules/settings/tickets/TicketAutomationsPanel";
import { TicketBillingDefaultsPanel } from "@/modules/settings/tickets/TicketBillingDefaultsPanel";
import { TicketInboxesManagePanel } from "@/modules/settings/tickets/TicketInboxesManagePanel";
import { TicketMacrosPanel } from "@/modules/settings/tickets/TicketMacrosPanel";
import { TicketNotificationsPanel } from "@/modules/settings/tickets/TicketNotificationsPanel";
import { TicketSlaPanel } from "@/modules/settings/tickets/TicketSlaPanel";
import { TicketSpamRoutingPanel } from "@/modules/settings/tickets/TicketSpamRoutingPanel";
import { TicketTemplatesExtrasPanel } from "@/modules/settings/tickets/TicketTemplatesExtrasPanel";
import { TicketWorkflowPanel } from "@/modules/settings/tickets/TicketWorkflowPanel";
import { TicketInboxReplySignatureSection } from "@/modules/settings/TicketInboxReplySignatureSection";
import { TicketInboxReplyTemplatesSection } from "@/modules/settings/TicketInboxReplyTemplatesSection";
import type { TicketsSectionId } from "@/modules/settings/settingsNavigation";

type Props = {
  activeSection: TicketsSectionId;
  onSectionChange: (section: TicketsSectionId) => void;
};

const ADMIN_MAIL_SECTIONS: TicketsSectionId[] = ["outbound", "inbound"];
const WORKSPACE_SECTIONS: TicketsSectionId[] = [
  "automations",
  "notifications",
  "inboxes",
  "workflow",
  "billing",
  "spam",
  "sla",
  "macros",
  "templates",
];

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

  const needsEmailSettings = ADMIN_MAIL_SECTIONS.includes(activeSection);

  const { data: emailData, isPending: emailPending } = useQuery({
    queryKey: ["email-delivery-settings"],
    queryFn: () => dataProvider.getEmailDeliverySettings(),
    enabled: isAdmin && needsEmailSettings,
  });

  if (!canAccess) {
    return (
      <p className="text-sm text-muted-foreground">
        You do not have permission to manage ticket settings.
      </p>
    );
  }

  const configured = emailData?.configured === true;

  const adminMailMessage = (
    <p className="text-sm text-muted-foreground">
      Outbound and inbound mail settings require an administrator.
    </p>
  );

  const mailLoading = (
    <div className="flex items-center gap-2 py-8 text-sm text-muted-foreground">
      <Loader2 className="size-4 animate-spin" />
      Loading ticket mail settings…
    </div>
  );

  const renderContent = () => {
    if (activeSection === "outbound") {
      if (!isAdmin) return adminMailMessage;
      if (emailPending || !emailData) return mailLoading;
      return <TicketOutboundPanel data={emailData} configured={configured} />;
    }
    if (activeSection === "inbound") {
      if (!isAdmin) return adminMailMessage;
      if (emailPending || !emailData) return mailLoading;
      return <TicketInboundPanel data={emailData} />;
    }
    if (WORKSPACE_SECTIONS.includes(activeSection)) {
      if (!canManageTickets && !isAdmin && !canManageSettings) {
        return (
          <p className="text-sm text-muted-foreground">
            Ticket workspace settings require manage permission.
          </p>
        );
      }
      switch (activeSection) {
        case "automations":
          return <TicketAutomationsPanel />;
        case "notifications":
          return <TicketNotificationsPanel />;
        case "inboxes":
          return <TicketInboxesManagePanel />;
        case "workflow":
          return <TicketWorkflowPanel />;
        case "billing":
          return <TicketBillingDefaultsPanel />;
        case "spam":
          return <TicketSpamRoutingPanel />;
        case "sla":
          return <TicketSlaPanel />;
        case "macros":
          return <TicketMacrosPanel />;
        case "templates":
          return <TicketTemplatesExtrasPanel />;
        default:
          return null;
      }
    }
    if (activeSection === "signature") {
      return <TicketInboxReplySignatureSection />;
    }
    return <TicketInboxReplyTemplatesSection />;
  };

  return (
    <SettingsSubNav
      value={activeSection}
      onValueChange={onSectionChange}
      items={[
        { id: "outbound", label: "Outbound (Twilio)" },
        { id: "inbound", label: "Inbound (SendGrid)" },
        { id: "automations", label: "Automations" },
        { id: "notifications", label: "Notifications" },
        { id: "inboxes", label: "Inboxes" },
        { id: "workflow", label: "Workflow" },
        { id: "billing", label: "Billing" },
        { id: "spam", label: "Spam & routing" },
        { id: "sla", label: "SLA & hours" },
        { id: "macros", label: "Macros" },
        { id: "templates", label: "Template library" },
        { id: "signature", label: "Reply signature" },
        { id: "reply_templates", label: "Reply templates" },
      ]}
      content={renderContent()}
    />
  );
};
