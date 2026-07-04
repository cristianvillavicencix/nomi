import { useMutation } from "@tanstack/react-query";
import { useState } from "react";
import { useDataProvider, useNotify } from "ra-core";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { CrmDataProvider } from "@/components/atomic-crm/providers/types";
import type { EmailDeliverySettings } from "@/modules/settings/EmailDeliverySettingsSection";
import {
  buildEmailSendersTableData,
  EmailSendersTable,
} from "@/modules/settings/integrations/EmailSendersTable";
import { IntegrationPanelHeader } from "@/modules/settings/integrations/IntegrationPanelHeader";
import type { IntegrationStatus } from "@/modules/settings/integrations/IntegrationListRow";
import { DEFAULT_TICKET_INBOX_EMAIL } from "@/modules/tickets/ticketInboxConfig";

const outboundStatusFor = (
  configured: boolean,
  data: EmailDeliverySettings,
): IntegrationStatus => {
  if (!configured) return "off";
  const senders = buildEmailSendersTableData(data);
  if (!senders.ticketInboxEnabled) return "partial";
  return "connected";
};

type Props = {
  data: EmailDeliverySettings;
  configured: boolean;
};

export const TicketOutboundPanel = ({ data, configured }: Props) => {
  const notify = useNotify();
  const dataProvider = useDataProvider<CrmDataProvider>();
  const [testEmail, setTestEmail] = useState("");
  const testMutation = useMutation({
    mutationFn: () => dataProvider.sendTestTicketOutboundEmail(testEmail.trim()),
    onSuccess: () => notify("Test email sent", { type: "success" }),
    onError: (error) =>
      notify(error instanceof Error ? error.message : "Failed to send test", {
        type: "error",
      }),
  });

  const inboxEmail =
    data.ticket_inbound?.support_email?.trim() || DEFAULT_TICKET_INBOX_EMAIL;
  const status = outboundStatusFor(configured, data);
  const senders = buildEmailSendersTableData(data);
  const fromAddress =
    senders.ticketInboxEmail?.trim() || DEFAULT_TICKET_INBOX_EMAIL;

  return (
    <div className="space-y-6">
      <IntegrationPanelHeader
        title="Outbound (Twilio Email)"
        description="When staff reply in Tickets, Nomi sends email through Twilio Email from the address below."
        status={status}
        badgeLabel={
          status === "connected"
            ? "Sending"
            : status === "partial"
              ? "Paused"
              : undefined
        }
        meta={fromAddress}
      />

      {!configured ? (
        <Alert>
          <AlertDescription>
            Connect Twilio under <strong>Integrations → Twilio</strong> first,
            then authenticate <strong>@{inboxEmail.split("@")[1]}</strong> in
            Twilio Console → Email.
          </AlertDescription>
        </Alert>
      ) : (
        <Alert className="border-blue-200/80 bg-blue-50/50 dark:border-blue-900/40 dark:bg-blue-950/20">
          <AlertDescription className="text-xs text-blue-950 dark:text-blue-100">
            <strong>Twilio Email</strong> is send-only for ticket replies. Clients
            do not reply through Twilio — inbound mail is configured under the{" "}
            <strong>Inbound (SendGrid)</strong> tab.
          </AlertDescription>
        </Alert>
      )}

      <section className="space-y-4 rounded-xl border border-blue-200/60 bg-blue-50/30 p-4 dark:border-blue-900/40 dark:bg-blue-950/10">
        <div className="space-y-1">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Sender
          </p>
          <p className="text-sm text-foreground">
            Ticket replies are sent from one address. Pause the switch to stop
            outbound mail without changing DNS.
          </p>
        </div>

        <EmailSendersTable
          configured={configured}
          data={senders}
          channels={["ticket"]}
        />

        <div className="space-y-2 border-t pt-4">
          <Label htmlFor="ticket-outbound-test">Send test outbound</Label>
          <div className="flex gap-2">
            <Input
              id="ticket-outbound-test"
              type="email"
              value={testEmail}
              onChange={(e) => setTestEmail(e.target.value)}
              placeholder="you@company.com"
              disabled={!configured}
            />
            <Button
              type="button"
              variant="outline"
              disabled={
                !configured || !testEmail.trim() || testMutation.isPending
              }
              onClick={() => testMutation.mutate()}
            >
              Send test
            </Button>
          </div>
        </div>
      </section>
    </div>
  );
};
