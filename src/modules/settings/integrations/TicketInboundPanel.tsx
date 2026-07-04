import { useNotify } from "ra-core";

import { Alert, AlertDescription } from "@/components/ui/alert";
import type { EmailDeliverySettings } from "@/modules/settings/EmailDeliverySettingsSection";
import { IntegrationPanelHeader } from "@/modules/settings/integrations/IntegrationPanelHeader";
import type { IntegrationStatus } from "@/modules/settings/integrations/IntegrationListRow";
import { TicketInboundDnsGuide } from "@/modules/settings/integrations/TicketInboundDnsGuide";
import {
  copyIntegrationText,
  IntegrationCopyField,
  IntegrationSummaryRow,
} from "@/modules/settings/integrations/ticketInboxIntegrationUi";
import { useTicketWorkspaceSettings } from "@/modules/settings/tickets/useTicketWorkspaceSettings";
import { DEFAULT_TICKET_INBOX_EMAIL } from "@/modules/tickets/ticketInboxConfig";

const inboundStatusFor = (
  inbound: EmailDeliverySettings["ticket_inbound"],
): IntegrationStatus => {
  if (!inbound) return "off";
  if (!inbound.webhook_configured) return "partial";
  if (inbound.is_active === false) return "partial";
  return "connected";
};

type Props = {
  data: EmailDeliverySettings;
};

export const TicketInboundPanel = ({ data }: Props) => {
  const notify = useNotify();
  const { data: workspaceBundle } = useTicketWorkspaceSettings();
  const health = workspaceBundle?.health;
  const inbound = data.ticket_inbound ?? null;
  const inboxEmail =
    inbound?.support_email?.trim() || DEFAULT_TICKET_INBOX_EMAIL;
  const status = inboundStatusFor(inbound);
  const hostname = inbound?.sendgrid_hostname ?? "supplements.lbs.bz";
  const forwardTo =
    inbound?.hostinger_forward_to?.trim() ||
    inbound?.sendgrid_forward_address?.trim() ||
    (hostname ? `inbox@${hostname}` : "");

  const handleCopy = (value: string) => void copyIntegrationText(value, notify);

  if (!inbound) {
    return (
      <div className="space-y-6">
        <IntegrationPanelHeader
          title="Inbound (SendGrid)"
          description="Receive client email into Tickets via SendGrid Inbound Parse and a Supabase webhook."
          status="off"
        />
        <Alert>
          <AlertDescription>
            No ticket inbox is configured for this organization. Contact your
            administrator to set up a row in{" "}
            <code className="rounded bg-muted px-1">ticket_inboxes</code>.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <IntegrationPanelHeader
        title="Inbound (SendGrid)"
        description="Clients write to your public support address. Mail is forwarded into SendGrid, then posted to Nomi."
        status={status}
        badgeLabel={
          status === "connected"
            ? "Receiving"
            : status === "partial"
              ? "Setup needed"
              : undefined
        }
        meta={inboxEmail}
      />

      <Alert className="border-emerald-200/80 bg-emerald-50/50 dark:border-emerald-900/40 dark:bg-emerald-950/20">
        <AlertDescription className="text-xs text-emerald-950 dark:text-emerald-100">
          <strong>SendGrid Inbound Parse</strong> receives mail (not Twilio Email
          New). Open Twilio Console → <strong>Email (SendGrid)</strong> →
          Settings → Inbound Parse.
        </AlertDescription>
      </Alert>

      <section className="space-y-4 rounded-xl border border-emerald-200/60 bg-emerald-50/30 p-4 dark:border-emerald-900/40 dark:bg-emerald-950/10">
        <div className="space-y-1">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Mail flow
          </p>
          <p className="text-sm text-foreground">
            Receive → forward → SendGrid → webhook → Tickets
          </p>
        </div>

        <div className="space-y-2">
          <IntegrationSummaryRow
            label="1. Receive (public address)"
            value={inboxEmail}
            ok={Boolean(inboxEmail)}
          />
          <IntegrationSummaryRow
            label="2. Forward (Hostinger → SendGrid)"
            value={
              forwardTo ? `${inboxEmail} → ${forwardTo}` : "Not configured"
            }
            ok={Boolean(forwardTo)}
            mono={false}
          />
          <IntegrationSummaryRow
            label="3. SendGrid host"
            value={hostname ? `*@${hostname}` : "Not configured"}
            ok={Boolean(hostname)}
          />
          <IntegrationSummaryRow
            label="4. MX record (DNS)"
            value={inbound.mx_record ?? "mx.sendgrid.net"}
            ok={Boolean(inbound.mx_record)}
          />
          <IntegrationSummaryRow
            label="5. Webhook (Supabase)"
            value={
              inbound.webhook_configured
                ? "email_inbound Edge Function"
                : "EMAIL_INBOUND_WEBHOOK_USER / PASSWORD missing"
            }
            ok={inbound.webhook_configured}
            mono={false}
          />
        </div>
      </section>

      {!inbound.webhook_configured ? (
        <Alert>
          <AlertDescription className="text-xs">
            Server webhook credentials are not set. Add{" "}
            <code className="rounded bg-muted px-1">
              EMAIL_INBOUND_WEBHOOK_USER
            </code>{" "}
            and{" "}
            <code className="rounded bg-muted px-1">
              EMAIL_INBOUND_WEBHOOK_PASSWORD
            </code>{" "}
            in Supabase Edge Function secrets.
          </AlertDescription>
        </Alert>
      ) : null}

      <section className="space-y-3 rounded-xl border bg-muted/10 p-4">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Health
        </p>
        <IntegrationSummaryRow
          label="Last inbound received"
          value={
            health?.last_inbound_at
              ? `${health.last_inbound_at} (${health.last_inbound_inbox_email ?? "inbox"})`
              : "No inbound mail recorded yet"
          }
          ok={Boolean(health?.last_inbound_at)}
          mono={false}
        />
        <IntegrationSummaryRow
          label="Outbound mail ready"
          value={health?.outbound_configured ? "Twilio Email configured" : "Not configured"}
          ok={health?.outbound_configured === true}
          mono={false}
        />
      </section>

      <section className="space-y-4 rounded-xl border bg-muted/10 p-4">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Copy &amp; paste values
        </p>

        <IntegrationCopyField
          label="SendGrid webhook URL (Destination URL)"
          value={inbound.webhook_url ?? ""}
          description="Paste in SendGrid Inbound Parse. Includes HTTP basic auth."
          onCopy={handleCopy}
          externalHref="https://console.twilio.com/us1/develop/email/settings/inbound-parse"
          externalLabel="Open SendGrid Inbound Parse"
        />

        <IntegrationCopyField
          label="SendGrid receiving host"
          value={hostname}
          description="All mail to *@this hostname is parsed by SendGrid."
          onCopy={handleCopy}
        />

        <IntegrationCopyField
          label="Hostinger forward destination"
          value={forwardTo}
          description={`Forward ${inboxEmail} to this address in Hostinger Email.`}
          onCopy={handleCopy}
        />
      </section>

      <TicketInboundDnsGuide setup={inbound} />
    </div>
  );
};
