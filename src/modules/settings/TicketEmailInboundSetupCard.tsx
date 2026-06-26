import { Copy } from "lucide-react";
import { useNotify } from "ra-core";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { TicketInboundSetup } from "@/modules/settings/EmailDeliverySettingsSection";

const copyText = async (
  value: string,
  notify: ReturnType<typeof useNotify>,
) => {
  try {
    await navigator.clipboard.writeText(value);
    notify("Copied to clipboard", { type: "info" });
  } catch {
    notify("Could not copy", { type: "warning" });
  }
};

const CopyField = ({
  label,
  value,
  description,
}: {
  label: string;
  value: string;
  description?: string;
}) => {
  const notify = useNotify();
  if (!value) return null;
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      {description ? (
        <p className="text-xs text-muted-foreground">{description}</p>
      ) : null}
      <div className="flex flex-col gap-2 sm:flex-row">
        <Input readOnly value={value} className="font-mono text-xs" />
        <Button
          type="button"
          variant="outline"
          onClick={() => void copyText(value, notify)}
        >
          <Copy className="size-4" />
          Copy
        </Button>
      </div>
    </div>
  );
};

export const TicketEmailInboundSetupCard = ({
  setup,
}: {
  setup: TicketInboundSetup | null;
}) => {
  if (!setup) return null;

  const hostname = setup.sendgrid_hostname ?? "supplements.lbs.bz";
  const forwardTo =
    setup.hostinger_forward_to ?? setup.sendgrid_forward_address ?? "";

  return (
    <div className="space-y-4 rounded-xl border bg-muted/20 p-4">
      <div>
        <h3 className="text-sm font-medium">Ticket inbox (inbound email)</h3>
        <p className="mt-1 text-sm text-muted-foreground">
          Receive support email at{" "}
          <span className="font-medium text-foreground">
            {setup.support_email}
          </span>
          . <strong className="text-foreground">Sending</strong> uses Twilio
          Email (invoices, ticket replies).{" "}
          <strong className="text-foreground">Receiving</strong> uses SendGrid
          Inbound Parse in the same Twilio account — open{" "}
          <strong className="text-foreground">Email (SendGrid)</strong>, not
          &quot;Twilio Email (New)&quot;.
        </p>
      </div>

      {!setup.webhook_configured ? (
        <p className="text-sm text-amber-700 dark:text-amber-400">
          Webhook credentials are not configured on the server yet. Contact your
          developer to set EMAIL_INBOUND_WEBHOOK_USER and
          EMAIL_INBOUND_WEBHOOK_PASSWORD in Supabase.
        </p>
      ) : null}

      <ol className="list-decimal space-y-4 pl-5 text-sm text-muted-foreground">
        <li>
          <span className="font-medium text-foreground">
            Hostinger DNS → add MX record first
          </span>
          <ul className="mt-2 list-disc space-y-1 pl-4">
            <li>
              Name: <code className="rounded bg-muted px-1">supplements</code>
            </li>
            <li>
              Value:{" "}
              <code className="rounded bg-muted px-1">{setup.mx_record}</code> ·
              Priority: <code className="rounded bg-muted px-1">10</code>
            </li>
            <li>
              Wait 15–60 minutes, then verify MX exists for{" "}
              <code className="rounded bg-muted px-1">{hostname}</code>
            </li>
          </ul>
        </li>
        <li>
          <span className="font-medium text-foreground">
            Twilio Console → Email (SendGrid) → Settings → Inbound Parse
          </span>
          <ul className="mt-2 list-disc space-y-1 pl-4">
            <li>
              Not &quot;Twilio Email (New)&quot; — that product is send-only
              today.
            </li>
            <li>
              Host name:{" "}
              <code className="rounded bg-muted px-1">supplements</code> ·
              Domain: <code className="rounded bg-muted px-1">lbs.bz</code>
            </li>
            <li>Destination URL: paste the webhook URL below</li>
            <li>Leave &quot;POST raw MIME&quot; unchecked</li>
          </ul>
        </li>
        <li>
          <span className="font-medium text-foreground">
            Hostinger Email → forward (after MX + SendGrid)
          </span>
          <ul className="mt-2 list-disc space-y-1 pl-4">
            <li>
              <code className="rounded bg-muted px-1">
                {setup.support_email}
              </code>{" "}
              → <code className="rounded bg-muted px-1">{forwardTo}</code>
            </li>
            <li>
              Hostinger sends a confirmation to{" "}
              <code className="rounded bg-muted px-1">{forwardTo}</code> — it
              does not go to your personal inbox. Open{" "}
              <strong className="text-foreground">Tickets</strong> in Nomi and
              look for a message from Hostinger with the confirm link.
            </li>
          </ul>
        </li>
        <li>
          Send a test email to{" "}
          <code className="rounded bg-muted px-1">{setup.support_email}</code>{" "}
          and check <strong className="text-foreground">Tickets</strong>.
        </li>
      </ol>

      <div className="rounded-lg border border-amber-200 bg-amber-50/80 px-3 py-2 text-sm text-amber-950 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-100">
        <p className="font-medium">
          Forward stuck on &quot;Waiting confirmation&quot;?
        </p>
        <p className="mt-1 text-amber-900/90 dark:text-amber-100/90">
          That happens when the MX record for{" "}
          <code className="rounded bg-muted px-1">{hostname}</code> is missing.
          Add MX → SendGrid Inbound Parse → resend confirmation → confirm from
          the ticket in Nomi. Or skip forwarding and use{" "}
          <code className="rounded bg-muted px-1">{forwardTo}</code> as your
          public support address.
        </p>
      </div>

      <CopyField
        label="SendGrid webhook URL (Destination URL)"
        value={setup.webhook_url ?? ""}
        description="Paste this in SendGrid Inbound Parse. Includes HTTP basic auth."
      />

      <CopyField
        label="SendGrid receiving host"
        value={hostname}
        description="All mail to *@this hostname is parsed by SendGrid."
      />

      <CopyField label="Hostinger forward destination" value={forwardTo} />
    </div>
  );
};
