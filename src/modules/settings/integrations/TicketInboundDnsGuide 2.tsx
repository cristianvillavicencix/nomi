import { ChevronRight } from "lucide-react";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { TicketInboundSetup } from "@/modules/settings/EmailDeliverySettingsSection";

export const TicketInboundDnsGuide = ({
  setup,
  defaultOpen = false,
}: {
  setup: TicketInboundSetup;
  defaultOpen?: boolean;
}) => {
  const [open, setOpen] = useState(defaultOpen);

  const hostname = setup.sendgrid_hostname ?? "supplements.lbs.bz";
  const forwardTo =
    setup.hostinger_forward_to ?? setup.sendgrid_forward_address ?? "";

  return (
    <div className="rounded-lg border border-dashed bg-muted/10">
      <button
        type="button"
        className="flex w-full items-start gap-3 p-3 text-left"
        onClick={() => setOpen((current) => !current)}
        aria-expanded={open}
      >
        <ChevronRight
          className={cn(
            "mt-0.5 size-4 shrink-0 text-muted-foreground transition-transform",
            open && "rotate-90",
          )}
        />
        <div className="min-w-0 flex-1 space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-sm font-medium">DNS &amp; SendGrid setup steps</p>
            <Badge variant="secondary" className="text-[10px] font-normal">
              Reference
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground">
            Only when first configuring or changing the inbox address or
            subdomain.
          </p>
        </div>
      </button>

      {open ? (
        <div className="space-y-4 border-t px-3 pb-3 pt-3">
          <p className="text-sm text-muted-foreground">
            <strong className="text-foreground">Sending</strong> uses Twilio
            Email. <strong className="text-foreground">Receiving</strong> uses
            SendGrid Inbound Parse — open{" "}
            <strong className="text-foreground">Email (SendGrid)</strong>, not
            &quot;Twilio Email (New)&quot;.
          </p>

          <ol className="list-decimal space-y-4 pl-5 text-sm text-muted-foreground">
            <li>
              <span className="font-medium text-foreground">
                Hostinger DNS → add MX record first
              </span>
              <ul className="mt-2 list-disc space-y-1 pl-4">
                <li>
                  Name:{" "}
                  <code className="rounded bg-muted px-1">supplements</code>
                </li>
                <li>
                  Value:{" "}
                  <code className="rounded bg-muted px-1">{setup.mx_record}</code>{" "}
                  · Priority: <code className="rounded bg-muted px-1">10</code>
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
                  Not &quot;Twilio Email (New)&quot; — that product is
                  send-only today.
                </li>
                <li>
                  Host name:{" "}
                  <code className="rounded bg-muted px-1">supplements</code> ·
                  Domain: <code className="rounded bg-muted px-1">lbs.bz</code>
                </li>
                <li>Paste the webhook URL from above as Destination URL</li>
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
                  Hostinger sends confirmation to{" "}
                  <code className="rounded bg-muted px-1">{forwardTo}</code> —
                  open <strong className="text-foreground">Tickets</strong> in
                  Nomi and confirm from the Hostinger message.
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
              Add MX for{" "}
              <code className="rounded bg-muted px-1">{hostname}</code> first,
              then SendGrid Inbound Parse, then resend confirmation. Or use{" "}
              <code className="rounded bg-muted px-1">{forwardTo}</code> as your
              public support address and skip Hostinger forwarding.
            </p>
          </div>
        </div>
      ) : null}
    </div>
  );
};
